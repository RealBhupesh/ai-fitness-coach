export function isProfileReadyForEdit(userId:string|undefined,profile:{userId:string}|null,loading:boolean,error:unknown) {
  return Boolean(userId && profile?.userId===userId && !loading && !error);
}
