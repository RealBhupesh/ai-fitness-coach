"""CPU-only logistic training. Raw data and trained research artifacts stay local."""
import argparse
import hashlib
import json
import math
import random
import statistics
from pathlib import Path

FEATURE_NAMES = ["angleMean", "angleMin", "angleMax", "angleRange", "angleVelocity", "torsoTilt", "elbowDrift", "kneeWidthRatio", "hipShift", "shoulderTilt", "visibility", "duration"]
FAULTS = {"squat": {"squat_depth", "knee_collapse", "torso_fold", "hip_shift"}, "bicep_curl": {"curl_elbow_drift", "curl_shoulder_hike", "curl_incomplete_rom"}}

def sigmoid(v):
    return 1 / (1 + math.exp(-max(-40, min(40, v))))

def logit(vector, weights, bias):
    return bias + sum(v*w for v,w in zip(vector, weights))

def fit(xs, ys, steps=1200, rate=0.08, penalty=0.01):
    weights = [0.0] * len(xs[0])
    bias = 0.0
    positives = sum(ys)
    if not positives or positives == len(ys):
        raise ValueError("Each split needs both positive and negative examples for every trained fault")
    for _ in range(steps):
        errors = [sigmoid(logit(x, weights, bias))-y for x,y in zip(xs,ys)]
        weights = [w-rate*(sum(e*x[j] for e,x in zip(errors,xs))/len(xs)+penalty*w) for j,w in enumerate(weights)]
        bias -= rate * sum(errors)/len(errors)
    return weights,bias

def metrics(predictions, labels):
    tp=sum(p and y for p,y in zip(predictions,labels))
    fp=sum(p and not y for p,y in zip(predictions,labels))
    fn=sum(not p and y for p,y in zip(predictions,labels))
    precision=tp/(tp+fp) if tp+fp else 0
    recall=tp/(tp+fn) if tp+fn else 0
    f1=2*precision*recall/(precision+recall) if precision+recall else 0
    return precision,recall,f1,{"tp":tp,"fp":fp,"fn":fn,"tn":len(labels)-tp-fp-fn}

def calibration_error(probabilities, labels):
    total=0
    for i in range(10):
        selected=[(p,y) for p,y in zip(probabilities,labels) if i/10<=p<(i+1)/10 or (i==9 and p==1)]
        if selected:
            total+=len(selected)*abs(statistics.mean(p for p,_ in selected)-statistics.mean(y for _,y in selected))
    return total/len(labels)

def grouped_uncertainty(predictions, baseline, labels, rows, draws=300):
    # Resample connected subject/video groups, never adjacent windows as independent data.
    parent={}
    def root(key):
        parent.setdefault(key,key)
        if parent[key]!=key:
            parent[key]=root(parent[key])
        return parent[key]
    for row in rows:
        parent[root("subject:"+row["subjectId"])]=root("video:"+row["videoId"])
    groups={}
    for index,row in enumerate(rows):
        groups.setdefault(root("subject:"+row["subjectId"]),[]).append(index)
    if len(groups)<2:
        return {"method":"connected-subject-video-bootstrap","status":"insufficient_independent_groups","groups":len(groups),"draws":0,"precision95":None,"f1_95":None,"deltaF1_95":None}
    counts=[]
    for indices in groups.values():
        y=[labels[i] for i in indices]
        counts.append((metrics([predictions[i] for i in indices],y)[3],metrics([baseline[i] for i in indices],y)[3]))
    rng=random.Random(13)
    def rates(confusion):
        tp,fp,fn=confusion["tp"],confusion["fp"],confusion["fn"]
        return (tp/(tp+fp) if tp+fp else 0,2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else 0)
    precision=[];f1=[];delta=[];undefined=0
    for _ in range(draws):
        chosen=[rng.choice(counts) for _ in counts]
        model={key:sum(item[0][key] for item in chosen) for key in ["tp","fp","fn"]}
        rules={key:sum(item[1][key] for item in chosen) for key in ["tp","fp","fn"]}
        p,score=rates(model);precision.append(p);f1.append(score);delta.append(score-rates(rules)[1])
        undefined+=int(model["tp"]+model["fp"]==0)
    def interval(values):
        values=sorted(values)
        def quantile(fraction):
            point=(len(values)-1)*fraction;low=math.floor(point);high=math.ceil(point)
            return values[low]+(values[high]-values[low])*(point-low)
        return [quantile(0.025),quantile(0.975)]
    return {"method":"connected-subject-video-bootstrap","status":"estimated" if len(groups)>=10 else "limited_groups","groups":len(groups),"draws":draws,"precision95":interval(precision),"f1_95":interval(f1),"deltaF1_95":interval(delta),"undefinedPrecisionDraws":undefined}


def validate_recording_manifest(rows, manifest, purpose):
    subjects=manifest.get("subjects", [])
    variants=manifest.get("exerciseVariants", {})
    definitions=manifest.get("labelDefinitions", {})
    recordings=manifest.get("recordings", [])
    if not subjects or any(not isinstance(v,str) or not v for v in subjects) or not recordings:
        raise ValueError("Manifest subjects and recordings are required")
    sources=manifest.get("sources", [])
    if any(purpose not in source.get("permittedUses", []) for source in sources):
        raise ValueError("Manifest permitted uses do not cover this training purpose")
    index={}
    for recording in recordings:
        key=(recording.get("sourceId"),recording.get("videoId"))
        if key in index or not all(key):
            raise ValueError("Recording identifiers must be unique within each source")
        index[key]=recording
    for row in rows:
        recording=index.get((row["sourceId"],row["videoId"]))
        if not recording or row["subjectId"] not in subjects or row["subjectId"] not in recording.get("subjectIds", []):
            raise ValueError("Recording/participant provenance mismatch")
        variant=row.get("exerciseVariant")
        exercise=row["exerciseId"]
        if not variant or variant not in variants.get(exercise, []) or variant not in recording.get("exerciseVariants", {}).get(exercise, []):
            raise ValueError("Exercise variant provenance mismatch")
        if any(not isinstance(definitions.get(fault),str) or not definitions[fault].strip() for fault in row["faults"]):
            raise ValueError("Genuine fault label definitions required")


def train(rows, manifest, exercise, purpose):
    if manifest.get("synthetic") is not False or any(row.get("synthetic") is True for row in rows):
        raise ValueError("Synthetic labels are not admissible training evidence")
    sources=manifest.get("sources",[])
    if not sources or any(s.get("type")!="public" or not s.get("license") or not s.get("url") for s in sources):
        raise ValueError("Public source URLs and explicit licenses required")
    permitted=all(s.get("deploymentPermitted") is True and s.get("rightsEvidence") for s in sources)
    if purpose=="deployment" and not permitted:
        raise ValueError("Dataset rights do not permit production deployment")
    source_ids={s["id"] for s in sources}
    rows=[r for r in rows if r["exerciseId"]==exercise]
    if not rows or any(r.get("sourceId") not in source_ids or r.get("featureVersion")!="temporal-v2" or r.get("featureNames")!=FEATURE_NAMES for r in rows):
        raise ValueError("Source or feature schema mismatch")
    if not manifest.get("labelProtocol"):
        raise ValueError("Document genuine label definitions and annotation protocol")
    splits={name:[r for r in rows if r.get("split")==name] for name in ["train","validation","test"]}
    if sum(len(v) for v in splits.values())!=len(rows) or any(not v for v in splits.values()):
        raise ValueError("Explicit train/validation/test assignments required")
    for key in ["subjectId","videoId"]:
        groups=[{r[key] for r in group} for group in splits.values()]
        if any(groups[i]&groups[j] for i in range(3) for j in range(i+1,3)):
            raise ValueError("Participant/source-video leakage detected")
    if any(len(r["features"])!=len(FEATURE_NAMES) or any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in r["features"]) for r in rows):
        raise ValueError("Finite feature vectors required")
    labels=set().union(*(set(r["faults"]) for r in rows))
    if not labels or not labels<=FAULTS[exercise]:
        raise ValueError("Unsupported or missing fault labels")
    validate_recording_manifest(rows,manifest,purpose)
    xs=[r["features"] for r in splits["train"]]
    mean=[statistics.mean(x[j] for x in xs) for j in range(len(FEATURE_NAMES))]
    scale=[max(statistics.pstdev(x[j] for x in xs),0.001) for j in range(len(FEATURE_NAMES))]
    transform=lambda row:[(v-m)/s for v,m,s in zip(row["features"],mean,scale)]
    classifiers=[];precision={};samples={};f1s=[];baseline_f1s=[];eces=[];details={}
    for fault in sorted(labels):
        train_y=[int(fault in r["faults"]) for r in splits["train"]]
        val_y=[int(fault in r["faults"]) for r in splits["validation"]]
        test_y=[int(fault in r["faults"]) for r in splits["test"]]
        weights,bias=fit([transform(r) for r in splits["train"]],train_y)
        a,b=fit([[logit(transform(r),weights,bias)] for r in splits["validation"]],val_y,steps=800,rate=0.04,penalty=0)
        val_prob=[sigmoid(a[0]*logit(transform(r),weights,bias)+b) for r in splits["validation"]]
        thresholds=[0.5+i*0.01 for i in range(50)]
        eligible=[t for t in thresholds if metrics([p>=t for p in val_prob],val_y)[0]>=0.9]
        threshold=max(eligible or [0.5],key=lambda t:metrics([p>=t for p in val_prob],val_y)[2])
        probs=[sigmoid(a[0]*logit(transform(r),weights,bias)+b) for r in splits["test"]]
        p,recall,f1,confusion=metrics([v>=threshold for v in probs],test_y)
        baseline=metrics([fault in r.get("baselineFaults",[]) for r in splits["test"]],test_y)[2]
        ece=calibration_error(probs,test_y)
        precision[fault]=p;samples[fault]=sum(test_y);f1s.append(f1);baseline_f1s.append(baseline);eces.append(ece)
        uncertainty=grouped_uncertainty([v>=threshold for v in probs],[fault in r.get("baselineFaults",[]) for r in splits["test"]],test_y,splits["test"])
        details[fault]={"precision":p,"recall":recall,"f1":f1,"confusion":confusion,"calibrationError":ece,"uncertainty":uncertainty}
        classifiers.append({"fault":fault,"weights":weights,"bias":bias,"calibrationA":a[0],"calibrationB":b,"threshold":threshold})
    digest=hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()
    manifest_hash=hashlib.sha256(json.dumps(manifest,sort_keys=True).encode()).hexdigest()
    code_hash=hashlib.sha256(Path(__file__).read_text(encoding="utf-8").encode()).hexdigest()
    artifact_hash=hashlib.sha256((digest+manifest_hash+code_hash+exercise+purpose).encode()).hexdigest()
    return {"version":"logistic-"+artifact_hash[:16],"featureVersion":"temporal-v2","modelType":"calibrated_logistic","exerciseId":exercise,"featureNames":FEATURE_NAMES,"mean":mean,"scale":scale,"classifiers":classifiers,
        "provenance":{"sources":[s["url"] for s in sources],"deploymentPermitted":bool(permitted),"synthetic":False,"labelProtocol":manifest["labelProtocol"],"splitHash":digest,"manifestHash":manifest_hash,"trainingCodeHash":code_hash},
        "evaluation":{"macroF1":statistics.mean(f1s),"baselineMacroF1":statistics.mean(baseline_f1s),"calibrationError":max(eces),"precision":precision,"samplesPerFault":samples,"subjectCount":len({r["subjectId"] for r in splits["test"]}),"cameraValidation":{"laptop":False,"androidLow":False,"androidMid":False,"evidenceId":""}},
        "report":{"splitCounts":{k:len(v) for k,v in splits.items()},"splitSubjectCounts":{k:len({r["subjectId"] for r in v}) for k,v in splits.items()},"splitVideoCounts":{k:len({r["videoId"] for r in v}) for k,v in splits.items()},"sourceWindowCounts":{source:sum(r["sourceId"]==source for r in rows) for source in sorted(source_ids)},"perFault":details,"limitations":["Public data performance does not establish webcam accuracy.","Bootstrap intervals describe observed test groups only; few groups or no observed errors can produce misleadingly narrow intervals. Undefined precision draws are scored as zero.","Camera validation is pending; do not promote this artifact.","Fault scores are independent; clean is a derived indicator, not joint calibrated probability."]}}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--input",required=True);parser.add_argument("--manifest",required=True)
    parser.add_argument("--exercise",choices=list(FAULTS),required=True)
    parser.add_argument("--output",default="reports/posture-model.json")
    parser.add_argument("--purpose",choices=["research","deployment"],default="research")
    args=parser.parse_args()
    rows=[json.loads(line) for line in Path(args.input).read_text(encoding="utf-8").splitlines() if line.strip()]
    artifact=train(rows,json.loads(Path(args.manifest).read_text(encoding="utf-8")),args.exercise,args.purpose)
    output=Path(args.output)
    if args.purpose!="deployment" and "public" in [part.lower() for part in output.resolve().parts]:
        raise ValueError("Research artifacts cannot be written into the public bundle")
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(artifact,indent=2)+"\n",encoding="utf-8")
    output.with_suffix(".md").write_text("# Posture model benchmark\n\n"+json.dumps(artifact["report"],indent=2)+"\n\nCamera validation pending. Learned cues remain gated.\n",encoding="utf-8")
    print("Exported",artifact["version"],"for",args.purpose,"with camera promotion disabled")
if __name__=="__main__":main()
