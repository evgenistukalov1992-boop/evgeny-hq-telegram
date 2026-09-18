const CLIENT_ID=process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET=process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI="https://evgeny-hq-telegram.vercel.app/api/google/callback";

export default async function handler(req,res){
 if(req.query?.error) return res.status(400).send("Google authorization denied");
 const code=req.query?.code;
 if(!code) return res.status(400).send("Missing authorization code");
 const r=await fetch("https://oauth2.googleapis.com/token",{
  method:"POST",
  headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({
   code,
   client_id:CLIENT_ID,
   client_secret:CLIENT_SECRET,
   redirect_uri:REDIRECT_URI,
   grant_type:"authorization_code"
  })
 });
 const data=await r.json();
 if(!r.ok) return res.status(500).send("OAuth token exchange failed");
 if(!data.refresh_token) return res.status(500).send("No refresh token returned. Re-authorize with consent.");
 // Deliberately do not expose the token in the browser or logs.
 return res.status(200).send("Google Calendar authorization succeeded, but persistent token storage is not configured yet. Return to ChatGPT.");
}