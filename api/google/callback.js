const CLIENT_ID=process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET=process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI="https://evgeny-hq-telegram.vercel.app/api/google/callback";
const EDGE_CONFIG_ID="ecfg_021jpfamhixkw9hkwilcsk5imnig";
const TEAM_SLUG="evgenistukalov1992-7198";

export default async function handler(req,res){
 if(req.query?.error) return res.status(400).send("Google authorization denied");
 const code=req.query?.code;
 if(!code) return res.status(400).send("Missing authorization code");
 if(!CLIENT_ID||!CLIENT_SECRET) return res.status(500).send("Google OAuth environment is incomplete");

 const r=await fetch("https://oauth2.googleapis.com/token",{
  method:"POST",
  headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({
   code,client_id:CLIENT_ID,client_secret:CLIENT_SECRET,
   redirect_uri:REDIRECT_URI,grant_type:"authorization_code"
  })
 });
 const data=await r.json();
 if(!r.ok) return res.status(500).send("OAuth token exchange failed: "+(data.error||"unknown_error"));
 if(!data.refresh_token) return res.status(500).send("No refresh token returned. Re-authorize with consent.");

 const writeToken=process.env.VERCEL_STORAGE_WRITE_TOKEN;
 if(!writeToken) return res.status(500).send("VERCEL_STORAGE_WRITE_TOKEN missing");

 const endpoint="https://api.vercel.com/v1/global-config/"+EDGE_CONFIG_ID+"/items?slug="+encodeURIComponent(TEAM_SLUG);
 const headers={Authorization:"Bearer "+writeToken,"Content-Type":"application/json"};
 const update=await fetch(endpoint,{
  method:"PATCH",headers,
  body:JSON.stringify({items:[{operation:"update",key:"google_calendar_refresh_token",value:data.refresh_token}]})
 });
 if(!update.ok){
  const create=await fetch(endpoint,{
   method:"PATCH",headers,
   body:JSON.stringify({items:[{operation:"create",key:"google_calendar_refresh_token",value:data.refresh_token,description:"Google Calendar OAuth refresh token for Evgeny HQ"}]})
  });
  if(!create.ok){
   let err={}; try{err=await create.json()}catch{}
   return res.status(500).send("OAuth succeeded, but token storage failed: "+(err.error?.code||err.error?.message||create.status));
  }
 }
 return res.status(200).send("Google Calendar connected. Refresh token stored securely. You can return to Telegram.");
}