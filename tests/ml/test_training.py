import importlib.util
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location("trainer",Path(__file__).parents[2]/"scripts/train_posture_model.py")
trainer=importlib.util.module_from_spec(spec);spec.loader.exec_module(trainer)
class TrainingBoundaryTests(unittest.TestCase):
 def test_research_rights_cannot_be_exported_for_deployment(self):
  manifest={"synthetic":False,"sources":[{"id":"public","type":"public","url":"https://example.org/research","license":"Research only","deploymentPermitted":False}],"labelProtocol":"Published annotations"}
  with self.assertRaisesRegex(ValueError,"rights"):
   trainer.train([],manifest,"squat","deployment")
 def test_synthetic_data_cannot_claim_real_training_evidence(self):
  with self.assertRaisesRegex(ValueError,"Synthetic"):
   trainer.train([],{"synthetic":True},"squat","research")
 def test_rejects_synthetic_rows_even_with_a_nonsynthetic_manifest(self):
  with self.assertRaisesRegex(ValueError,"Synthetic"):
   trainer.train([{"synthetic":True}],{"synthetic":False},"squat","research")
 def test_rejects_subject_leakage_across_splits(self):
  manifest={"synthetic":False,"sources":[{"id":"public","type":"public","url":"https://example.org/research","license":"Research only","deploymentPermitted":False}],"labelProtocol":"Published annotations"}
  rows=[{"sourceId":"public","subjectId":"same-person","videoId":split,"exerciseId":"squat","featureVersion":"temporal-v2","featureNames":trainer.FEATURE_NAMES,"features":[1]*12,"faults":["squat_depth"],"split":split} for split in ["train","validation","test"]]
  with self.assertRaisesRegex(ValueError,"leakage"):
   trainer.train(rows,manifest,"squat","research")
class ManifestTests(unittest.TestCase):
 def fixture(self):
  row={"sourceId":"source","videoId":"video","subjectId":"subject","exerciseId":"squat","exerciseVariant":"bodyweight","faults":["squat_depth"]}
  manifest={"subjects":["subject"],"exerciseVariants":{"squat":["bodyweight"]},"labelDefinitions":{"squat_depth":"Published positive-label definition"},"sources":[{"id":"source","permittedUses":["research"]}],"recordings":[{"sourceId":"source","videoId":"video","subjectIds":["subject"],"exerciseVariants":{"squat":["bodyweight"]}}]}
  return row,manifest
 def test_accepts_complete_recording_provenance_without_training_weights(self):
  row,manifest=self.fixture();trainer.validate_recording_manifest([row],manifest,"research")
 def test_rejects_unlisted_participants_or_variants(self):
  row,manifest=self.fixture();row["subjectId"]="unlisted"
  with self.assertRaisesRegex(ValueError,"provenance"):
   trainer.validate_recording_manifest([row],manifest,"research")
  row["subjectId"]="subject";row["exerciseVariant"]="unlisted"
  with self.assertRaisesRegex(ValueError,"variant"):
   trainer.validate_recording_manifest([row],manifest,"research")
 def test_requires_label_definitions_and_permitted_uses(self):
  row,manifest=self.fixture();manifest["labelDefinitions"]={}
  with self.assertRaisesRegex(ValueError,"definitions"):
   trainer.validate_recording_manifest([row],manifest,"research")
  row,manifest=self.fixture()
  with self.assertRaisesRegex(ValueError,"permitted uses"):
   trainer.validate_recording_manifest([row],manifest,"deployment")
 def test_unobservable_wrist_fault_is_not_trainable_in_current_features(self):
  self.assertNotIn("curl_wrist_fold",trainer.FAULTS["bicep_curl"])

class UncertaintyTests(unittest.TestCase):
 def test_resamples_independent_groups_reproducibly(self):
  rows=[{"subjectId":str(i//2),"videoId":str(i//2)} for i in range(20)]
  labels=[i%2==0 for i in range(20)]
  first=trainer.grouped_uncertainty(labels,[False]*20,labels,rows,draws=40)
  self.assertEqual(first,trainer.grouped_uncertainty(labels,[False]*20,labels,rows,draws=40))
  self.assertEqual(first["groups"],10);self.assertEqual(first["f1_95"],[1.0,1.0])
 def test_shared_recording_is_one_group(self):
  rows=[{"subjectId":str(i),"videoId":"shared-recording"} for i in range(10)]
  result=trainer.grouped_uncertainty([True]*10,[False]*10,[True]*10,rows)
  self.assertEqual(result["groups"],1);self.assertIsNone(result["precision95"])

if __name__=="__main__":unittest.main()
