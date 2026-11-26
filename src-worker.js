const corsHeaders = {"Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET, POST, OPTIONS", "Access-Control-Allow-Headers":"Content-Type, X-Telegram-Init-Data"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...corsHeaders}});}
async function verifyTelegramInitData(initData,botToken,maxAgeSeconds=86400){
 if(!initData||!botToken)return null;
 const params=new URLSearchParams(initData), hash=params.get("hash"); if(!hash)return null; params.delete("hash");
 const entries=[...params.entries()].sort(([a],[b])=>a.localeCompare(b));
 const check=entries.map(([k,v])=>`${k}=${v}`).join("\\n"), enc=new TextEncoder();
 const key=await crypto.subtle.importKey("raw",enc.encode("WebAppData"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const secret=await crypto.subtle.sign("HMAC",key,enc.encode(botToken));
 const validation=await crypto.subtle.importKey("raw",secret,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const sig=await crypto.subtle.sign("HMAC",validation,enc.encode(check));
 const calculated=[...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,"0")).join("");
 if(calculated.length!==hash.length)return null; let diff=0; for(let i=0;i<hash.length;i++)diff|=calculated.charCodeAt(i)^hash.charCodeAt(i); if(diff)return null;
 const authDate=Number(params.get("auth_date")); if(!Number.isFinite(authDate)||Math.abs(Date.now()/1000-authDate)>maxAgeSeconds)return null;
 try{return JSON.parse(params.get("user")||"null");}catch{return null;}
}
export default {async fetch(request,env){
 if(request.method==="OPTIONS")return new Response(null,{headers:corsHeaders});
 const url=new URL(request.url);
 if(url.pathname==="/api/health"&&request.method==="GET")return json({ok:true});
 if(url.pathname==="/api/analyze"&&request.method==="POST"){
  try{
   const user=await verifyTelegramInitData(request.headers.get("X-Telegram-Init-Data"),env.BOT_TOKEN);
   if(!user?.id)return json({error:"کاربر تلگرام تأیید نشد؛ برنامه را از داخل تلگرام باز کنید."},401);
   if(!env.AI_API_URL||!env.AI_API_KEY)return json({error:"تنظیمات API هوش مصنوعی تکمیل نشده است."},503);
   const data=await request.formData(),audio=data.get("audio");
   if(!(audio instanceof File)||!audio.size)return json({error:"فایل صوتی معتبر نیست."},400);
   if(audio.size>Number(env.MAX_AUDIO_BYTES||15728640))return json({error:"حجم فایل بیش از حد مجاز است."},413);
   const forwarded=new FormData();forwarded.append("file",audio,audio.name||"audio");
   const api=await fetch(env.AI_API_URL,{method:"POST",headers:{Authorization:`Bearer ${env.AI_API_KEY}`},body:forwarded});
   if(!api.ok)return json({error:"سرویس تحلیل پاسخ‌گو نیست."},502);
   const result=await api.json(),items=Array.isArray(result.emotions)?result.emotions:[];
   if(!items.length)return json({error:"پاسخ API باید شامل emotions باشد."},502);
   const sum=items.reduce((s,x)=>s+Math.max(0,Number(x.score)||0),0)||1;
   const emotions=items.map(x=>({name:String(x.name||"نامشخص").slice(0,40),emoji:x.emoji||"🎭",percent:Math.round(Math.max(0,Number(x.score)||0)/sum*100)})).sort((a,b)=>b.percent-a.percent);
   const output={dominant:emotions[0],allEmotions:emotions,timestamp:new Date().toISOString(),fileSize:audio.size,fileName:audio.name||"audio"};
   await env.DB.prepare("INSERT INTO analyses (telegram_user_id, username, dominant_emotion, percentages_json, file_name, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(String(user.id),user.username||null,output.dominant.name,JSON.stringify(emotions),output.fileName,output.fileSize,output.timestamp).run();
   return json(output);
  }catch(e){console.error(e);return json({error:"خطای داخلی تحلیل."},500);}
 }
 if(url.pathname==="/api/history"&&request.method==="GET"){
  try{const user=await verifyTelegramInitData(request.headers.get("X-Telegram-Init-Data"),env.BOT_TOKEN);if(!user?.id)return json({error:"کاربر تأیید نشد."},401);
   const rows=await env.DB.prepare("SELECT id, dominant_emotion, percentages_json, file_name, file_size, created_at FROM analyses WHERE telegram_user_id = ? ORDER BY id DESC LIMIT 50").bind(String(user.id)).all();return json({history:rows.results||[]});
  }catch(e){console.error(e);return json({error:"خطا در تاریخچه."},500);}
 }
 return env.ASSETS.fetch(request);
}};
