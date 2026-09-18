const CLIENT_ID=process.env.GOOGLE_CLIENT_ID;
const REDIRECT="https://evgeny-hq-telegram.vercel.app/api/google/callback";
export default async function handler(req,res){
 if(!CLIENT_ID) return res.status(500).send("GOOGLE_CLIENT_ID missing");
 const p=new URLSearchParams({
  client_id:CLIENT_ID,redirect_uri:REDIRECT,response_type:"code",
  access_type:"offline",prompt:"consent",
  scope:"https://www.googleapis.com/auth/calendar",
  state:"evgeny-hq-calendar"
 });
 return res.redirect("https://accounts.google.com/o/oauth2/v2/auth?"+p.toString());
}