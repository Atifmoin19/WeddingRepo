import "./style.css";
import { CONFIG } from "./config.js";

(function(){

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,"0");
const ord=n=>{const s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])};
const D=iso=>new Date(iso);
const longDate=d=>`${ord(d.getDate())} ${d.toLocaleString("en-GB",{month:"long"})} ${d.getFullYear()}`;
const day=d=>d.toLocaleString("en-GB",{weekday:"long"});
const time=d=>d.toLocaleString("en-US",{hour:"numeric",minute:"2-digit"});
// Opens the venue pin in the Maps app. Uses the event's own link when one is set in the config.
const mapUrl=e=>e.map||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.venue+", "+e.addr)}`;
const main=CONFIG.events.find(e=>e.when===CONFIG.countdownTo)||CONFIG.events[0];
const md=D(main.when);
const K={...CONFIG,dots:`${pad(md.getDate())} · ${pad(md.getMonth()+1)} · ${md.getFullYear()}`,day:day(md),time:time(md),dateLong:longDate(md)};
const k=n=>`<span data-k="${n}"></span>`;
const chars=(t,d0=0,step=.06)=>`<span class="chars" aria-label="${t}">${[...t].map((c,i)=>`<span aria-hidden="true" style="transition-delay:${(d0*.45+i*step*.6).toFixed(2)}s">${c===" "?"&nbsp;":c}</span>`).join("")}</span>`;
const orn=(d=0)=>`<svg class="orn" style="--d:${d}s" viewBox="0 0 150 16" aria-hidden="true"><path d="M0 8H62M88 8H150" stroke="#a67c3d" stroke-opacity=".7"/><path d="M75 1l3 4 5 1-4 3 1 5-5-2-5 2 1-5-4-3 5-1z" fill="#a67c3d"/><circle cx="66" cy="8" r="1.6" fill="#a67c3d"/><circle cx="84" cy="8" r="1.6" fill="#a67c3d"/></svg>`;
const R=(d,html,cls="rv",sp)=>`<div class="${cls}" style="--d:${(d*.45).toFixed(2)}s"${sp!=null?` data-sp="${sp}"`:""}>${html}</div>`;
const P=(sp,html)=>`<div data-sp="${sp}" style="width:100%;display:flex;flex-direction:column;align-items:center;gap:7px">${html}</div>`;

/* ===== blocks (one continuous card) ===== */
const S=[
 {id:"verse",kind:"frame",name:"Opening ayat",html:()=>`
   ${R(.1,`<p class="ar gold" style="font-size:clamp(36px,11cqw,46px);line-height:1.9">وَخَلَقْنَاكُمْ أَزْوَاجًا</p>`,"wipe")}
   ${R(1.2,`<p class="lead" style="font-size:21px">“And We created you in pairs”</p>`)}
   ${R(1.5,`<p class="eyebrow" style="margin-top:6px;font-size:12px">Qur'an 78 : 8</p>`)}
   ${orn(1.7)}
   ${R(2.4,`<div class="hintdown" aria-hidden="true" style="margin-top:40px">SCROLL<svg width="12" height="8" viewBox="0 0 12 8"><path d="M1 1l5 5 5-5" fill="none" stroke="#a67c3d"/></svg></div>`)}`},
 {id:"qubool",kind:"couple",name:"Monogram · Qubool Hai",html:()=>`
   ${R(.1,`<div class="wreath"><svg viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke="#a67c3d" stroke-width="1.6" stroke-linecap="round"><path class="stem" d="M47.5 43.6 A80 80 0 0 0 100.0 184.0 A80 80 0 0 0 152.5 43.6"/><path class="stem" d="M47.5 43.6 q-2 -12 8 -14 q8 0 6 8 q-2 5 -7 3" /><path class="stem" d="M152.5 43.6 q2 -12 -8 -14 q-8 0 -6 8 q2 5 7 3" /></g><circle cx="100" cy="184" r="3" fill="#a67c3d"/><g fill="#f1e6cc" stroke="#a67c3d" stroke-width="1"><ellipse class="lf" style="transition-delay:0.30s" cx="119.3" cy="190.5" rx="7.5" ry="2.9" transform="rotate(52.0 119.3 190.5)"/><ellipse class="lf" style="transition-delay:0.30s" cx="116.4" cy="173.7" rx="7.5" ry="2.9" transform="rotate(-72.0 116.4 173.7)"/><ellipse class="lf" style="transition-delay:0.36s" cx="146.4" cy="179.5" rx="7.5" ry="2.9" transform="rotate(33.0 146.4 179.5)"/><ellipse class="lf" style="transition-delay:0.36s" cx="138.2" cy="164.6" rx="7.5" ry="2.9" transform="rotate(-91.0 138.2 164.6)"/><ellipse class="lf" style="transition-delay:0.42s" cx="168.4" cy="160.2" rx="7.5" ry="2.9" transform="rotate(14.0 168.4 160.2)"/><ellipse class="lf" style="transition-delay:0.42s" cx="155.8" cy="148.9" rx="7.5" ry="2.9" transform="rotate(-110.0 155.8 148.9)"/><ellipse class="lf" style="transition-delay:0.48s" cx="183.0" cy="134.9" rx="7.5" ry="2.9" transform="rotate(-5.0 183.0 134.9)"/><ellipse class="lf" style="transition-delay:0.48s" cx="167.4" cy="128.3" rx="7.5" ry="2.9" transform="rotate(-129.0 167.4 128.3)"/><ellipse class="lf" style="transition-delay:0.54s" cx="188.6" cy="106.2" rx="7.5" ry="2.9" transform="rotate(-24.0 188.6 106.2)"/><ellipse class="lf" style="transition-delay:0.54s" cx="171.6" cy="105.0" rx="7.5" ry="2.9" transform="rotate(-148.0 171.6 105.0)"/><ellipse class="lf" style="transition-delay:0.60s" cx="184.4" cy="77.2" rx="7.5" ry="2.9" transform="rotate(-43.0 184.4 77.2)"/><ellipse class="lf" style="transition-delay:0.60s" cx="168.0" cy="81.6" rx="7.5" ry="2.9" transform="rotate(-167.0 168.0 81.6)"/><ellipse class="lf" style="transition-delay:0.66s" cx="171.1" cy="51.2" rx="7.5" ry="2.9" transform="rotate(-62.0 171.1 51.2)"/><ellipse class="lf" style="transition-delay:0.66s" cx="157.0" cy="60.7" rx="7.5" ry="2.9" transform="rotate(-186.0 157.0 60.7)"/><ellipse class="lf" style="transition-delay:0.72s" cx="150.1" cy="30.9" rx="7.5" ry="2.9" transform="rotate(-81.0 150.1 30.9)"/><ellipse class="lf" style="transition-delay:0.72s" cx="139.8" cy="44.5" rx="7.5" ry="2.9" transform="rotate(-205.0 139.8 44.5)"/><ellipse class="lf" style="transition-delay:0.30s" cx="80.7" cy="190.5" rx="7.5" ry="2.9" transform="rotate(128.0 80.7 190.5)"/><ellipse class="lf" style="transition-delay:0.30s" cx="83.6" cy="173.7" rx="7.5" ry="2.9" transform="rotate(252.0 83.6 173.7)"/><ellipse class="lf" style="transition-delay:0.36s" cx="53.6" cy="179.5" rx="7.5" ry="2.9" transform="rotate(147.0 53.6 179.5)"/><ellipse class="lf" style="transition-delay:0.36s" cx="61.8" cy="164.6" rx="7.5" ry="2.9" transform="rotate(271.0 61.8 164.6)"/><ellipse class="lf" style="transition-delay:0.42s" cx="31.6" cy="160.2" rx="7.5" ry="2.9" transform="rotate(166.0 31.6 160.2)"/><ellipse class="lf" style="transition-delay:0.42s" cx="44.2" cy="148.9" rx="7.5" ry="2.9" transform="rotate(290.0 44.2 148.9)"/><ellipse class="lf" style="transition-delay:0.48s" cx="17.0" cy="134.9" rx="7.5" ry="2.9" transform="rotate(185.0 17.0 134.9)"/><ellipse class="lf" style="transition-delay:0.48s" cx="32.6" cy="128.3" rx="7.5" ry="2.9" transform="rotate(309.0 32.6 128.3)"/><ellipse class="lf" style="transition-delay:0.54s" cx="11.4" cy="106.2" rx="7.5" ry="2.9" transform="rotate(204.0 11.4 106.2)"/><ellipse class="lf" style="transition-delay:0.54s" cx="28.4" cy="105.0" rx="7.5" ry="2.9" transform="rotate(328.0 28.4 105.0)"/><ellipse class="lf" style="transition-delay:0.60s" cx="15.6" cy="77.2" rx="7.5" ry="2.9" transform="rotate(223.0 15.6 77.2)"/><ellipse class="lf" style="transition-delay:0.60s" cx="32.0" cy="81.6" rx="7.5" ry="2.9" transform="rotate(347.0 32.0 81.6)"/><ellipse class="lf" style="transition-delay:0.66s" cx="28.9" cy="51.2" rx="7.5" ry="2.9" transform="rotate(242.0 28.9 51.2)"/><ellipse class="lf" style="transition-delay:0.66s" cx="43.0" cy="60.7" rx="7.5" ry="2.9" transform="rotate(366.0 43.0 60.7)"/><ellipse class="lf" style="transition-delay:0.72s" cx="49.9" cy="30.9" rx="7.5" ry="2.9" transform="rotate(261.0 49.9 30.9)"/><ellipse class="lf" style="transition-delay:0.72s" cx="60.2" cy="44.5" rx="7.5" ry="2.9" transform="rotate(385.0 60.2 44.5)"/></g></svg><div class="mg"><b class="gold">${CONFIG.groom[0]}</b><i class="gold">&amp;</i><b class="gold">${CONFIG.bride[0]}</b></div></div>`)}
   ${R(1.2,`<p class="lead" style="font-size:22px">saying.....</p>`)}
   ${R(1.5,`<p class="ur gold" style="font-size:clamp(38px,11.5cqw,48px);line-height:2;padding:0 .2em">قبول ہے</p>`,"wipe")}
   ${R(2.3,`<p class="caps" style="font-size:13px;letter-spacing:.32em;color:var(--ink-soft);margin-top:10px">Qubool Hai</p>`)}`},
 {id:"families",kind:"plain",name:"Bismillah & families",html:()=>`
   ${R(.1,`<p class="ar gold" style="font-size:clamp(24px,7.4cqw,30px);line-height:1.7">بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>`,"wipe")}
   ${R(1,`<p class="par" style="font-style:italic">In the name of Allah, the Most Beneficent, the Most Merciful</p>`)}
   ${R(1.3,`<p class="host" style="margin-top:4px">${CONFIG.hosts.replace(" & ","<br>&amp;<br>")}</p>`)}
   ${R(1.6,`<p class="req">Request the pleasure of your gracious presence on the auspicious occasion of the Dawat-e-Walima of their beloved son</p>`)}
   ${R(1.9,`<p class="script gold" style="font-size:clamp(36px,10.5cqw,44px)">${CONFIG.groomFull}</p><p class="par">${CONFIG.groomParents.replace(" & ","<br>&amp; ")}</p>`)}
   ${R(2.2,`<svg width="34" height="26" viewBox="0 0 44 34" aria-hidden="true"><g fill="none" stroke="#a67c3d" stroke-width="1.8"><circle cx="16" cy="20" r="10"/><circle cx="28" cy="20" r="10"/></g><path d="M22 4l3 4-3 3-3-3z" fill="#a67c3d"/><g fill="#a67c3d"><circle cx="9" cy="5" r="1"/><circle cx="35" cy="5" r="1"/></g></svg>`)}
   ${R(2.4,`<p class="script gold" style="font-size:clamp(36px,10.5cqw,44px)">${CONFIG.brideFull}</p><p class="par">${CONFIG.brideParents.replace(" & ","<br>&amp; ")}</p>`)}`},
 {id:"scratch",kind:"plain",name:"Scratch to reveal",html:()=>`
   ${R(.1,`<p class="eyebrow">A little surprise</p>`)}
   ${R(.3,`<h2 class="script gold mid">Save the Date</h2>`)}
   ${R(.6,`<div class="scr" id="scr"><div class="under"><span class="caps" style="font-size:9px;color:var(--gold)">${k("day")}</span><span class="script gold" style="font-size:30px">Walima</span><b class="caps" style="font-size:17px;letter-spacing:.12em;color:var(--ink)">${k("dots")}</b><span class="sm">${k("time")} onwards</span></div><canvas width="440" height="440" aria-label="Scratch the gold seal to reveal the date"></canvas></div>`)}
   ${R(.9,`<p class="caps hint" style="font-size:9.5px;color:var(--gold)" id="scrhint">Scratch the gold seal</p>`)}
   <a class="btn solid" href="#" data-cal="" id="savebtn" hidden>Save the Date</a>`},
 {id:"countdown",kind:"frame",name:"Countdown",html:()=>`
   ${R(.1,`<p class="ar gold" style="font-size:28px">إِنْ شَاءَ ٱللَّٰهُ</p>`,"wipe")}
   ${R(.9,`<p class="lead">Counting every moment to the</p>`)}
   ${P(.08,R(1.1,`<h2 class="script gold big">Walima</h2>`))}
   ${R(1.4,`<div class="cd" id="cd"><div><b>--</b><span>Days</span></div><div><b>--</b><span>Hours</span></div><div><b>--</b><span>Mins</span></div><div><b>--</b><span>Secs</span></div></div>`)}
   ${orn(.8)}
   ${R(1.9,`<p class="caps" style="font-size:10.5px;color:var(--ink)">${k("day")} · ${k("dateLong")}</p><p class="sm">${k("time")} onwards</p>`)}`},
 {id:"letter",kind:"plain",name:"Dear family letter",html:()=>`
   ${R(.1,`<p class="eyebrow">Our invitation</p>`)}
   ${R(.3,`<h2 class="script gold" style="font-size:clamp(30px,8.6cqw,38px)">Dear Family &amp; Friends</h2>`)}
   ${orn(.25)}
   ${R(.7,`<p class="lead" style="font-size:17px;max-width:28ch">By the grace of Allah, we joyfully invite you to share in our celebrations. Your presence, prayers and blessings would mean the world to us as we begin this new journey together.</p>`)}
   ${R(1.2,`<p class="sm" style="margin-top:8px">With love,</p><p class="script gold" style="font-size:46px">${CONFIG.groom}&nbsp;<span style="font-size:.62em">&amp;</span>&nbsp;${CONFIG.bride}</p>`)}`},
 {id:"events",kind:"plain",name:"Wedding events",html:()=>`
   ${R(.1,`<p class="eyebrow">Celebrating together</p>`)}
   ${R(.3,`<h2 class="script gold mid">Wedding Events</h2>`)}
   ${orn(.4)}
   ${R(.6,`<div class="evx" id="evx">${CONFIG.events.filter(e=>e.on).map(e=>{const d=D(e.when);return `<article class="ecard">
     <p class="d1">${day(d)}</p><p class="d1">${ord(d.getDate())} ${d.toLocaleString("en-GB",{month:"long"})} ${d.getFullYear()}</p>
     <p class="tm">${time(d)} onwards</p>
     <p class="nm">${e.name}</p><p class="u">${e.ur}</p>
     <svg width="20" height="24" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 26C5 17 2 13 2 9.5a10 10 0 0 1 20 0C22 13 19 17 12 26z" fill="none" stroke="#a67c3d" stroke-width="1.6"/><circle cx="12" cy="10" r="3.4" fill="none" stroke="#a67c3d" stroke-width="1.6"/></svg><p class="vn">${e.venue}</p><p class="ad">${e.addr}</p>
     <a class="ebtn" href="${mapUrl(e)}" target="_blank" rel="noopener" style="margin-top:12px"><svg width="15" height="18" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 26C5 17 2 13 2 9.5a10 10 0 0 1 20 0C22 13 19 17 12 26z" fill="none" stroke="#a67c3d" stroke-width="1.6"/><circle cx="12" cy="10" r="3.4" fill="none" stroke="#a67c3d" stroke-width="1.6"/></svg>Open in Maps</a>
     <a class="ebtn g" href="#" data-cal="${e.name}" style="margin-top:8px"><svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8"/></svg>Add to Calendar</a></article>`}).join("")}</div>`)}
   ${R(.8,`<div class="edots" id="edots">${CONFIG.events.filter(e=>e.on).map((e,i)=>`<i class="${i?"":"on"}"></i>`).join("")}</div><p class="caps" style="font-size:9.5px;letter-spacing:.26em;color:var(--gold);margin-top:8px">Swipe for next event</p>`)}`},
 {id:"gift",kind:"frame",name:"Nikah favour box",html:()=>`
   ${R(.1,`<p class="eyebrow">A sweet gesture</p>`)}
   ${R(.3,`<h2 class="script gold mid">Shirini for You</h2>`)}
   <div class="giftwrap" id="giftwrap"><div class="hb" id="giftbox" role="button" tabindex="0" aria-label="Open the favour box"><svg viewBox="0 -70 320 362" role="img" aria-label="Nikah favour box">
<defs>
 <linearGradient id="gBody" x1="0" x2="1"><stop offset="0" stop-color="#a99f8e"/><stop offset=".1" stop-color="#d3ccbf"/><stop offset=".3" stop-color="#f4f1ea"/><stop offset=".44" stop-color="#ffffff"/><stop offset=".62" stop-color="#f1ede5"/><stop offset=".86" stop-color="#cfc7b9"/><stop offset="1" stop-color="#a1978a"/></linearGradient>
 <radialGradient id="gTop" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f3efe8"/><stop offset="1" stop-color="#d9d2c5"/></radialGradient>
 <linearGradient id="gAO" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3a2a14" stop-opacity=".42"/><stop offset="1" stop-color="#3a2a14" stop-opacity="0"/></linearGradient>
 <linearGradient id="gIn" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#cfc6b6"/><stop offset=".45" stop-color="#8d7a58"/><stop offset="1" stop-color="#5c4a2c"/></linearGradient>
 <linearGradient id="gGold" x1="0" x2="1"><stop offset="0" stop-color="#7d5d22"/><stop offset=".22" stop-color="#e9cf8a"/><stop offset=".4" stop-color="#a8822f"/><stop offset=".55" stop-color="#fbeebd"/><stop offset=".78" stop-color="#b08a3a"/><stop offset="1" stop-color="#6f5220"/></linearGradient>
 <linearGradient id="gSat" x1="0" x2="1"><stop offset="0" stop-color="#3f060d"/><stop offset=".22" stop-color="#84131f"/><stop offset=".42" stop-color="#cf5565"/><stop offset=".52" stop-color="#b22a3b"/><stop offset=".8" stop-color="#75101c"/><stop offset="1" stop-color="#3a050b"/></linearGradient>
 <linearGradient id="gSatTop" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#6d0f1a"/><stop offset=".45" stop-color="#b62f40"/><stop offset=".6" stop-color="#d96879"/><stop offset="1" stop-color="#8a1623"/></linearGradient>
 <linearGradient id="gLoop" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7a111d"/><stop offset=".28" stop-color="#d4596b"/><stop offset=".5" stop-color="#a82435"/><stop offset="1" stop-color="#4a0810"/></linearGradient>
 <linearGradient id="gLoopIn" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2c0408"/><stop offset="1" stop-color="#6a0e19"/></linearGradient>
 <radialGradient id="gSeal" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#fbe7a6"/><stop offset=".45" stop-color="#d3a640"/><stop offset="1" stop-color="#7f5a14"/></radialGradient>
 <radialGradient id="gLad" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#ffd27a"/><stop offset=".5" stop-color="#e88d1f"/><stop offset="1" stop-color="#8f4a08"/></radialGradient>
 <radialGradient id="gJam" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#b9592a"/><stop offset=".5" stop-color="#6a2609"/><stop offset="1" stop-color="#260b02"/></radialGradient>
 <radialGradient id="gFoil" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#fff0b8"/><stop offset=".5" stop-color="#cfa347"/><stop offset="1" stop-color="#5f440f"/></radialGradient>
 <radialGradient id="gSilv" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#b9bec4"/><stop offset="1" stop-color="#54585d"/></radialGradient>
 <filter id="fPaper" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5" result="n"/><feColorMatrix in="n" values="0 0 0 0 .32  0 0 0 0 .26  0 0 0 0 .18  0 0 0 .55 -.17" result="g"/><feComposite in="g" in2="SourceAlpha" operator="in" result="gc"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gc"/></feMerge></filter>
 <filter id="fGrain" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="9" result="n"/><feColorMatrix in="n" values="0 0 0 0 .4  0 0 0 0 .18  0 0 0 0 0  0 0 0 1.5 -.55" result="g"/><feComposite in="g" in2="SourceAlpha" operator="in" result="gc"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gc"/></feMerge></filter>
 <filter id="fFoil" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".16" numOctaves="3" seed="4" result="n"/>
   <feDiffuseLighting in="n" surfaceScale="4.5" diffuseConstant="1.15" lighting-color="#ffffff" result="d"><feDistantLight azimuth="225" elevation="52"/></feDiffuseLighting>
   <feComponentTransfer in="d" result="d2"><feFuncR type="linear" slope=".55" intercept=".5"/><feFuncG type="linear" slope=".55" intercept=".5"/><feFuncB type="linear" slope=".55" intercept=".5"/></feComponentTransfer><feBlend in="SourceGraphic" in2="d2" mode="multiply" result="m"/>
   <feSpecularLighting in="n" surfaceScale="5" specularConstant=".9" specularExponent="22" lighting-color="#fffbe6" result="s"><feDistantLight azimuth="225" elevation="48"/></feSpecularLighting>
   <feComposite in="s" in2="m" operator="arithmetic" k2="1" k3="1" result="a"/><feComposite in="a" in2="SourceAlpha" operator="in"/></filter>
 <filter id="fSeal" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5"/></filter>
 <filter id="fBlur1"><feGaussianBlur stdDeviation="1.1"/></filter>
 <filter id="fBlur2"><feGaussianBlur stdDeviation="2.2"/></filter>
 <filter id="fBlur8" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="8"/></filter>
 <filter id="fDrop" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3.5" stdDeviation="3" flood-color="#2a0a0c" flood-opacity=".42"/></filter>
 <filter id="fDropS" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#2a1a08" flood-opacity=".45"/></filter>
 <clipPath id="cTop"><ellipse cx="160" cy="112" rx="124" ry="32"/></clipPath>
 <clipPath id="cIn"><path d="M42 60 L42 150 A118 30 0 0 0 278 150 L278 60 Z"/></clipPath>
 <g id="bowL">
   <path d="M160 107 C150 82 104 62 86 80 C72 96 96 118 160 110 Z" fill="url(#gLoop)"/>
   <path d="M152 105 C140 92 112 82 101 88 C96 97 118 106 152 105 Z" fill="url(#gLoopIn)"/>
   <path d="M158 106 C140 96 112 76 90 82" fill="none" stroke="#f3a3b0" stroke-opacity=".5" stroke-width="2.4" stroke-linecap="round" filter="url(#fBlur1)"/>
   <path d="M159 109 C146 110 132 113 120 112 M158 104 C150 98 146 93 143 88" fill="none" stroke="#2c0408" stroke-opacity=".55" stroke-width="1.2" stroke-linecap="round"/>
 </g>
 <g id="tailL">
   <path d="M150 99 L163 116 L124 146.5 L103 138 Z" fill="url(#gSatTop)"/>
   <path d="M103 138 L124 146.5 L125 197 L114 188 L103 198 Z" fill="url(#gSat)"/>
   <path d="M103 138 L124 146.5" stroke="#2c0408" stroke-opacity=".5" stroke-width="1.4"/>
   <path d="M104 141 L124.5 149.5 L124.7 156 L103.6 147 Z" fill="#2c0408" opacity=".22"/>
 </g>
</defs>

<ellipse cx="160" cy="279" rx="150" ry="17" fill="#3a2a14" opacity=".42" filter="url(#fBlur8)"/>
<ellipse cx="160" cy="279" rx="116" ry="9" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/>

<!-- body -->
<path d="M42 150 L42 250 A118 30 0 0 0 278 250 L278 150 Z" fill="url(#gBody)" filter="url(#fPaper)"/>
<path d="M42 240 A118 30 0 0 0 278 240" fill="none" stroke="url(#gGold)" stroke-width="2.6"/>
<path d="M42 244 A118 30 0 0 0 278 244 L278 250 A118 30 0 0 1 42 250 Z" fill="#3a2a14" opacity=".1"/>
<g text-anchor="middle">
  <text x="160" y="211" font-family="Cinzel, serif" font-weight="600" font-size="10.5" letter-spacing="3.2" fill="#93723a">${CONFIG.groom[0]} &amp; ${CONFIG.bride[0]}</text>
  <text x="160" y="237" font-family="Allura, 'Great Vibes', cursive" font-size="27" fill="#8a6a2a">Nikah Mubarak</text>
  <text x="160" y="253" font-family="Cinzel, serif" font-weight="500" font-size="8" letter-spacing="3" fill="#93723a">${K.dots}</text>
</g>

<!-- inside -->
<ellipse cx="160" cy="150" rx="118" ry="30" fill="url(#gIn)"/>
<path d="M42 150 A118 30 0 0 1 278 150" fill="none" stroke="#e4ddd0" stroke-width="2"/>
<g clip-path="url(#cIn)"><g class="swt"><ellipse cx="78" cy="148.0" rx="13.5" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="78" cy="136" r="15" fill="url(#gFoil)" filter="url(#fFoil)"/></g><g class="swt"><ellipse cx="100" cy="150.0" rx="13.5" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="100" cy="138" r="15" fill="url(#gLad)" filter="url(#fGrain)"/></g><g class="swt"><ellipse cx="130" cy="148.0" rx="13.5" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="130" cy="136" r="15" fill="url(#gJam)"/><ellipse cx="124.8" cy="129.2" rx="4.8" ry="2.7" fill="#fff" opacity=".55" filter="url(#fBlur1)"/></g><g class="swt"><ellipse cx="160" cy="150.0" rx="13.5" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="160" cy="138" r="15" fill="url(#gSilv)" filter="url(#fFoil)"/></g><g class="swt"><ellipse cx="190" cy="148.0" rx="13.5" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="190" cy="136" r="15" fill="url(#gLad)" filter="url(#fGrain)"/></g><g class="swt"><ellipse cx="220" cy="150.0" rx="13.5" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="220" cy="138" r="15" fill="url(#gFoil)" filter="url(#fFoil)"/></g><g class="swt"><ellipse cx="242" cy="148.0" rx="13.5" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="242" cy="136" r="15" fill="url(#gJam)"/><ellipse cx="236.8" cy="129.2" rx="4.8" ry="2.7" fill="#fff" opacity=".55" filter="url(#fBlur1)"/></g><g class="swt"><ellipse cx="66" cy="159.8" rx="14.4" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="66" cy="147" r="16" fill="url(#gLad)" filter="url(#fGrain)"/></g><g class="swt"><ellipse cx="86" cy="161.8" rx="14.4" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="86" cy="149" r="16" fill="url(#gFoil)" filter="url(#fFoil)"/></g><g class="swt"><ellipse cx="115" cy="159.8" rx="14.4" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="115" cy="147" r="16" fill="url(#gSilv)" filter="url(#fFoil)"/></g><g class="swt"><ellipse cx="145" cy="161.8" rx="14.4" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="145" cy="149" r="16" fill="url(#gJam)"/><ellipse cx="139.4" cy="141.8" rx="5.1" ry="2.9" fill="#fff" opacity=".55" filter="url(#fBlur1)"/></g><g class="swt"><ellipse cx="175" cy="159.8" rx="14.4" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="175" cy="147" r="16" fill="url(#gLad)" filter="url(#fGrain)"/></g><g class="swt"><ellipse cx="205" cy="161.8" rx="14.4" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="205" cy="149" r="16" fill="url(#gFoil)" filter="url(#fFoil)"/></g><g class="swt"><ellipse cx="234" cy="159.8" rx="14.4" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="234" cy="147" r="16" fill="url(#gLad)" filter="url(#fGrain)"/></g><g class="swt"><ellipse cx="254" cy="161.8" rx="14.4" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="254" cy="149" r="16" fill="url(#gJam)"/><ellipse cx="248.4" cy="141.8" rx="5.1" ry="2.9" fill="#fff" opacity=".55" filter="url(#fBlur1)"/></g><g class="swt"><ellipse cx="85" cy="170.8" rx="14.4" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="85" cy="158" r="16" fill="url(#gFoil)" filter="url(#fFoil)"/></g><g class="swt"><ellipse cx="115" cy="172.8" rx="14.4" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="115" cy="160" r="16" fill="url(#gLad)" filter="url(#fGrain)"/></g><g class="swt"><ellipse cx="145" cy="170.8" rx="14.4" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="145" cy="158" r="16" fill="url(#gSilv)" filter="url(#fFoil)"/></g><g class="swt"><ellipse cx="175" cy="172.8" rx="14.4" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="175" cy="160" r="16" fill="url(#gFoil)" filter="url(#fFoil)"/></g><g class="swt"><ellipse cx="205" cy="170.8" rx="14.4" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="205" cy="158" r="16" fill="url(#gJam)"/><ellipse cx="199.4" cy="150.8" rx="5.1" ry="2.9" fill="#fff" opacity=".55" filter="url(#fBlur1)"/></g><g class="swt"><ellipse cx="235" cy="172.8" rx="14.4" ry="4" fill="#2a1a08" opacity=".35" filter="url(#fBlur2)"/><circle cx="235" cy="160" r="16" fill="url(#gLad)" filter="url(#fGrain)"/></g></g>
<path d="M42 150 A118 30 0 0 0 278 150" fill="none" stroke="#fffdf8" stroke-width="3"/>
<path class="ao" d="M36 150 A124 32 0 0 0 284 150 L284 166 A124 32 0 0 1 36 166 Z" fill="url(#gAO)"/>

<!-- lid -->
<g class="lidmove"><g class="lidrot">
  <g fill="#eef0e4" filter="url(#fDropS)"><g stroke="#6f8a52" stroke-width="1.2" fill="none" stroke-linecap="round"><path d="M160 104 C150 86 136 74 118 62"/><path d="M160 104 C160 84 160 66 160 46"/><path d="M160 104 C170 86 184 74 202 62"/><path d="M146 84 C138 78 130 72 128 66"/><path d="M174 84 C182 78 190 72 192 66"/><path d="M152 76 C148 66 142 60 138 54"/><path d="M168 76 C172 66 178 60 182 54"/></g><circle cx="118" cy="62" r="3.4"/><circle cx="112" cy="68" r="2.8"/><circle cx="124" cy="57" r="2.6"/><circle cx="128" cy="66" r="2.4"/><circle cx="106" cy="60" r="2.2"/><circle cx="160" cy="46" r="3.4"/><circle cx="154" cy="51" r="2.7"/><circle cx="166" cy="52" r="2.8"/><circle cx="160" cy="57" r="2.4"/><circle cx="152" cy="43" r="2.0"/><circle cx="202" cy="62" r="3.4"/><circle cx="208" cy="68" r="2.8"/><circle cx="196" cy="57" r="2.6"/><circle cx="192" cy="66" r="2.4"/><circle cx="214" cy="60" r="2.2"/><circle cx="138" cy="54" r="2.5"/><circle cx="182" cy="54" r="2.5"/><circle cx="144" cy="62" r="2.1"/><circle cx="176" cy="62" r="2.1"/><circle cx="170" cy="44" r="2.0"/></g>
  <path d="M36 112 L36 150 A124 32 0 0 0 284 150 L284 112 Z" fill="url(#gBody)" filter="url(#fPaper)"/>
  <path d="M36 142 A124 32 0 0 0 284 142" fill="none" stroke="url(#gGold)" stroke-width="2.2"/>
  <ellipse cx="160" cy="112" rx="124" ry="32" fill="url(#gTop)" filter="url(#fPaper)"/>
  <ellipse cx="160" cy="112" rx="123" ry="31.2" fill="none" stroke="#ffffff" stroke-opacity=".9" stroke-width="1.4"/>
  <path d="M36 113 A124 32 0 0 0 284 113" fill="none" stroke="#b9b0a0" stroke-opacity=".7" stroke-width="1"/>
  <g filter="url(#fDrop)">
    <g clip-path="url(#cTop)"><path d="M150 78 L170 78 L175.5 145 L144.5 145 Z" fill="url(#gSat)"/></g>
    <path d="M144.6 143.2 Q160 144.4 175.4 143.2 L175.4 181.3 Q160 182.4 144.6 181.3 Z" fill="url(#gSat)"/>
    <path d="M144.6 143.2 Q160 144.4 175.4 143.2 L175.4 149 Q160 150.2 144.6 149 Z" fill="#2c0408" opacity=".3"/>
    <use href="#tailL"/><use href="#tailL" transform="translate(320 0) scale(-1 1)"/>
    <use href="#bowL"/><use href="#bowL" transform="translate(320 0) scale(-1 1)"/>
  </g>
  <g filter="url(#fDropS)">
    <circle cx="160" cy="106" r="19" fill="url(#gSeal)" filter="url(#fSeal)"/>
    <circle cx="160" cy="106.8" r="13" fill="none" stroke="#fff3c4" stroke-opacity=".8" stroke-width="1.2"/>
    <circle cx="160" cy="106" r="13" fill="none" stroke="#6f4f12" stroke-opacity=".75" stroke-width="1.2"/>
    <g text-anchor="middle" font-family="Allura, 'Great Vibes', cursive" font-size="15"><text x="160" y="112" fill="#fff3c4" opacity=".85">${CONFIG.groom[0]}&amp;${CONFIG.bride[0]}</text><text x="160" y="111.2" fill="#77540f">${CONFIG.groom[0]}&amp;${CONFIG.bride[0]}</text></g>
    <ellipse class="glint" cx="154" cy="98" rx="7" ry="2.6" fill="#fff" filter="url(#fBlur1)" transform="rotate(-28 154 98)"/>
    <ellipse cx="153" cy="96" rx="6" ry="2.2" fill="#fff" opacity=".45" filter="url(#fBlur1)" transform="rotate(-28 153 96)"/>
  </g>
</g></g>
</svg></div></div>
   <p class="gmsg script gold" style="font-size:34px">Muh Meetha Kijiye!</p>
   ${R(.6,`<button class="btn solid" type="button" id="giftbtn">Open your gift</button>`)}`},
 {id:"duas",kind:"frame",name:"Duas & RSVP",html:()=>`
   ${R(.1,`<p class="eyebrow">RSVP</p>`)}
   ${P(.08,R(.3,`<h2 class="script gold mid">Send your Duas</h2>`))}
   ${R(.5,`<p class="lead" style="font-size:17px;max-width:26ch">Let us know you will be joining us, and keep us in your prayers.</p>`)}
   ${R(.8,`<form class="duaf" id="duaf" novalidate>
     <div class="seg" role="group" aria-label="Will you attend?"><button type="button" data-a="yes" aria-pressed="false">InshaAllah, Yes</button><button type="button" data-a="no" aria-pressed="false">Can't make it</button></div>
     <div class="fields" id="rsvpfields" hidden>
       <input id="dn" name="n" placeholder="Your name (required)" aria-label="Your name" autocomplete="name" maxlength="60">
       <p class="err" id="rsvperr" hidden>Please enter your name.</p>
       <input id="dt" name="t" placeholder="Your dua or message (optional)" aria-label="Your dua or message" maxlength="300">
       <button class="btn solid" type="submit" id="rsvpgo" style="justify-content:center;margin-top:6px">Confirm my presence</button>
     </div>
     <div class="thanks" id="rsvpthanks" hidden><p class="script gold" style="font-size:34px">JazakAllah Khair</p><p class="sm" id="rsvpmsg"></p><a class="btn" id="rsvpwa" href="#" target="_blank" rel="noopener" style="margin-top:6px">Also message us on WhatsApp</a></div>
   </form>`)}`},
 {id:"closing",kind:"frame",name:"Closing dua & share",html:()=>`
   ${R(.1,`<p class="ar gold" style="font-size:20px;line-height:1.9">بَارَكَ اللَّهُ لَكُمَا وَبَارَكَ عَلَيْكُمَا<br>وَجَمَعَ بَيْنَكُمَا فِي خَيْرٍ</p>`,"wipe")}
   ${R(1.6,`<p class="sm" style="font-style:italic">May Allah bless you both and unite you in goodness. Ameen.</p>`)}
   ${orn(.8)}
   <h2 class="script gold" style="font-size:clamp(36px,10.5cqw,46px);margin-top:4px">${chars(CONFIG.groom+" & "+CONFIG.bride,1.9,.05)}</h2>
   ${R(2.6,`<p class="caps" style="font-size:10px;color:var(--gold)">${k("hashtag")}</p>`)}
   ${R(2.9,`<p class="sm" style="margin-top:4px">With warm regards<br><b>${k("hosts")}</b></p>`)}
   ${R(3.1,`<button class="btn solid" type="button" id="share" style="margin-top:8px">Share Invitation</button>`)}`}
];

const deck=$("#deck");
deck.innerHTML=S.map(s=>`<section class="blk ${s.kind}" id="${s.id}" aria-label="${s.name}"><div class="bg" aria-hidden="true"><i class="m"></i><i class="t"></i><i class="b"></i></div><div class="safe">${s.html()}</div></section>`).join("");
$$("[data-k]").forEach(e=>e.textContent=K[e.dataset.k]??"");

/* reveal + parallax */
let opened=false;
const RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
const dots=$("#dots");
dots.innerHTML=S.map((s,i)=>`<button type="button" aria-label="Go to ${s.name}" data-i="${i}"></button>`).join("");
dots.addEventListener("click",e=>{const b=e.target.closest("button");if(b)$$(".blk")[b.dataset.i].scrollIntoView({behavior:"smooth"})});
const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;const i=$$(".blk").indexOf(e.target);$$("button",dots).forEach((b,j)=>b.setAttribute("aria-current",i===j));if(opened)e.target.classList.add("in")}),{root:deck,threshold:.55});
$$(".blk").forEach(s=>io.observe(s));

/* envelope */
const intro=$("#intro");
requestAnimationFrame(()=>requestAnimationFrame(()=>intro.classList.add("ready")));
function openInvite(){if(intro.classList.contains("open"))return;intro.classList.add("open");navigator.vibrate?.(30);setMusic(true);
  setTimeout(()=>{const r=$(".seal").getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2,28)},450);
  setTimeout(()=>{opened=true;startPetals();$$(".blk").forEach(b=>{const r=b.getBoundingClientRect(),d=deck.getBoundingClientRect();if(r.top<d.bottom&&r.bottom>d.top)b.classList.add("in")})},1500);
  setTimeout(()=>{intro.hidden=true},2700)}
intro.addEventListener("click",openInvite);intro.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openInvite()}});

/* gold dust */
const cv=$("#dust"),cx=cv.getContext("2d");let W,H;
function size(){const r=cv.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;cx.setTransform(dpr,0,0,dpr,0,0)}
size();addEventListener("resize",size);
const sprite=document.createElement("canvas");sprite.width=sprite.height=32;{const s=sprite.getContext("2d"),g=s.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,"rgba(255,250,230,1)");g.addColorStop(.25,"rgba(243,223,166,.9)");g.addColorStop(1,"rgba(214,180,112,0)");s.fillStyle=g;s.fillRect(0,0,32,32)}
const PT=Array.from({length:44},()=>({x:Math.random(),y:Math.random(),r:2+Math.random()*7,v:.00015+Math.random()*.0004,ph:Math.random()*6.28,sw:.5+Math.random()}));
let lastS=0;
function loop(t){cx.clearRect(0,0,W,H);const ds=(deck.scrollTop-lastS)/H;lastS=deck.scrollTop;
  for(const p of PT){p.y-=p.v+ds*p.r*.04;if(p.y<-.05){p.y=1.05;p.x=Math.random()}if(p.y>1.06)p.y=-.04;const a=.25+.55*Math.abs(Math.sin(t/900*p.sw+p.ph));cx.globalAlpha=a;const x=(p.x+Math.sin(t/3000+p.ph)*.02)*W;cx.drawImage(sprite,x-p.r,p.y*H-p.r,p.r*2,p.r*2)}
  if(!RM)requestAnimationFrame(loop)}
requestAnimationFrame(loop);

/* petals (leaf-shaped, tumbling) */
function startPetals(){if(RM||$("#petals").childElementCount)return;let h="";for(let i=0;i<18;i++){const l=Math.random()*100,d=10+Math.random()*9,dl=-Math.random()*16,f=2.2+Math.random()*3,s=9+Math.random()*8;
  h+=`<span class="petal" style="left:${l}%;--dx:${(Math.random()*120-60).toFixed(0)}px;animation-duration:${d}s;animation-delay:${dl}s"><svg width="${s}" height="${s*1.25}" viewBox="0 0 20 25" style="animation-duration:${f}s"><defs><radialGradient id="pg${i}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#FFFDF7"/><stop offset=".7" stop-color="#F3E6CC"/><stop offset="1" stop-color="#E2CFA8"/></radialGradient></defs><path d="M10 1C17 6 19 15 10 24C1 15 3 6 10 1Z" fill="url(#pg${i})" opacity=".92"/><path d="M10 4C11 10 11 16 10 21" stroke="#E0C99C" stroke-width=".6" fill="none" opacity=".6"/></svg></span>`}$("#petals").innerHTML=h}

/* tap sparkles */
const taps=$("#taps"),stage=$("#stage");
function burst(px,py,n=10){const r=stage.getBoundingClientRect();for(let i=0;i<n;i++){const s=document.createElement("i");s.className="spark";const a=Math.random()*6.28,d=20+Math.random()*(n>12?110:45);s.style.left=(px-r.left)+"px";s.style.top=(py-r.top)+"px";s.style.setProperty("--x",Math.cos(a)*d+"px");s.style.setProperty("--y",Math.sin(a)*d+"px");taps.appendChild(s);setTimeout(()=>s.remove(),950)}}
deck.addEventListener("pointerdown",e=>{if(!e.target.closest("canvas,input,button,a"))burst(e.clientX,e.clientY)});

/* music: plays CONFIG.music after the envelope is opened; button hidden when no track is set */
const mu=$("#music");let audio=null;
if(CONFIG.music){audio=new Audio(CONFIG.music);audio.loop=true;audio.volume=.6}else{mu.hidden=true}
function setMusic(on){if(!audio)return;mu.classList.toggle("on",on);mu.querySelector(".note").style.display=on?"none":"";mu.querySelector(".eqb").hidden=!on;mu.setAttribute("aria-label",on?"Pause music":"Play music");
  if(on)audio.play().catch(()=>setMusic(false));else audio.pause()}
mu.addEventListener("click",()=>setMusic(!mu.classList.contains("on")));
document.addEventListener("visibilitychange",()=>{if(document.hidden&&audio&&!audio.paused){audio.pause();audio._resume=true}else if(!document.hidden&&audio?._resume){audio._resume=false;audio.play().catch(()=>{})}});

/* scratch */
const sc=$("#scr canvas"),sx=sc.getContext("2d");let down=false,done=false;
function foil(){done=false;sc.style.opacity=1;$("#scr").classList.remove("done");sx.globalCompositeOperation="source-over";
  const g=sx.createLinearGradient(0,0,440,440);g.addColorStop(0,"#8a6a32");g.addColorStop(.3,"#e9cf8f");g.addColorStop(.5,"#fff1c4");g.addColorStop(.7,"#c9a45f");g.addColorStop(1,"#7a5626");sx.fillStyle=g;sx.fillRect(0,0,440,440);
  for(let i=0;i<2600;i++){sx.fillStyle=`rgba(${Math.random()<.5?"255,248,220":"90,60,20"},${Math.random()*.18})`;sx.fillRect(Math.random()*440,Math.random()*440,1.5,1.5)}
  sx.strokeStyle="rgba(255,250,230,.45)";sx.lineWidth=1.2;for(let r=60;r<220;r+=26){sx.beginPath();sx.arc(220,220,r,0,7);sx.stroke()}
  sx.fillStyle="#4a3420";sx.textAlign="center";sx.font="500 26px Cinzel, serif";sx.fillText("SCRATCH",220,212);sx.font="italic 26px 'Cormorant Garamond', serif";sx.fillText("to reveal",220,246)}
const pt=e=>{const r=sc.getBoundingClientRect();return[(e.clientX-r.left)*440/r.width,(e.clientY-r.top)*440/r.height]};
function scratch(e){if(!down||done)return;const[x,y]=pt(e);sx.globalCompositeOperation="destination-out";sx.beginPath();sx.arc(x,y,34,0,7);sx.fill();
  const d=sx.getImageData(0,0,440,440).data;let n=0,t=0;for(let i=3;i<d.length;i+=120){t++;if(d[i]<40)n++}
  if(n/t>.48){done=true;sc.style.opacity=0;$("#scr").classList.add("done");navigator.vibrate?.([20,40,20]);const r=sc.getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2,30);$("#scrhint").textContent="See you there, InshaAllah";$("#savebtn").hidden=false}}
sc.addEventListener("pointerdown",e=>{down=true;sc.setPointerCapture(e.pointerId);scratch(e)});sc.addEventListener("pointermove",scratch);sc.addEventListener("pointerup",()=>down=false);
foil();document.fonts?.ready.then(foil);

/* countdown */
const cdb=$$("#cd b");let last=[];
function tick(){const ms=Math.max(0,D(CONFIG.countdownTo)-Date.now());const v=[ms/864e5,ms/36e5%24,ms/6e4%60,ms/1e3%60].map(n=>pad(Math.floor(n)));
  v.forEach((x,i)=>{if(x!==last[i]){cdb[i].textContent=x;cdb[i].classList.remove("flip");void cdb[i].offsetWidth;cdb[i].classList.add("flip")}});last=v}
tick();setInterval(tick,1000);


/* event swipe dots */
const evx=$("#evx"),ed=$$("#edots i");evx.addEventListener("scroll",()=>{const i=Math.round(evx.scrollLeft/evx.clientWidth);ed.forEach((d,j)=>d.classList.toggle("on",i===j))},{passive:true});

/* gift box */
const gift=$("#giftbox"),gw=$("#giftwrap"),gb=$("#giftbtn");
function toggleGift(){const open=!gift.classList.contains("open");gift.classList.toggle("open",open);gw.parentElement.classList.toggle("gift-open",open);gb.textContent=open?"Close the box":"Open your gift";
  if(open){navigator.vibrate?.([15,30,15]);setTimeout(()=>{const r=gift.getBoundingClientRect();burst(r.left+r.width/2,r.top,26)},350)}}
gift.addEventListener("click",toggleGift);gb.addEventListener("click",toggleGift);gift.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggleGift()}});

/* RSVP. Yes: name + optional message, saved to the Google Sheet. No: name + optional message, sent on WhatsApp. */
const f=$("#duaf"),fields=$("#rsvpfields"),go=$("#rsvpgo"),err=$("#rsvperr");let attending=null;
const waLink=msg=>`https://wa.me/${(CONFIG.whatsapp||"").replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`;
$$(".seg button",f).forEach(b=>b.addEventListener("click",()=>{attending=b.dataset.a;
  $$(".seg button",f).forEach(x=>x.setAttribute("aria-pressed",x===b));
  fields.hidden=false;err.hidden=true;go.textContent=attending==="yes"?"Confirm my presence":"Send on WhatsApp";f.n.focus({preventScroll:true})}));
f.n.addEventListener("input",()=>{err.hidden=true});
f.addEventListener("submit",e=>{e.preventDefault();if(!attending)return;
  const n=f.n.value.trim(),t=f.t.value.trim();
  if(!n){err.hidden=false;f.n.focus({preventScroll:true});return}
  const msg=`Assalamu Alaikum! This is ${n}. ${attending==="yes"?"InshaAllah I will attend":"Sorry, I will not be able to attend"} the Walima of ${CONFIG.groom} & ${CONFIG.bride}.${t?" "+t:""}`;
  if(attending==="no"){window.open(waLink(msg),"_blank","noopener")}
  else if(CONFIG.sheetUrl){
    fetch(CONFIG.sheetUrl,{method:"POST",mode:"no-cors",keepalive:true,headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({name:n,attending:"Yes",dua:t,guest:CONFIG.guest,page:location.href})}).catch(()=>{})}
  $(".seg",f).hidden=true;fields.hidden=true;$("#rsvpthanks").hidden=false;
  $("#rsvpmsg").textContent=attending==="yes"?`Thank you, ${n}. We have noted your presence and look forward to seeing you.`:`Thank you for letting us know, ${n}. Please keep us in your duas.`;
  $("#rsvpwa").href=waLink(msg);$("#rsvpwa").hidden=attending==="no";
  const r=f.getBoundingClientRect();burst(r.left+r.width/2,r.top+40,22)});

/* add to calendar: opens the guest's calendar with the event filled in (date, time, venue, map link, reminders) */
const isApple=/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
function addToCalendar(e){
  const stamp=d=>d.toISOString().replace(/[-:]|\.\d{3}/g,"");
  const start=D(e.when),end=new Date(+start+(e.hours||4)*36e5);
  const title=`${e.name} - ${CONFIG.groom} & ${CONFIG.bride}`,where=`${e.venue}, ${e.addr}`;
  const details=`You are invited to the ${e.name} of ${CONFIG.groomFull} & ${CONFIG.brideFull}.\nVenue: ${where}\nMap: ${mapUrl(e)}`;
  if(!isApple){ // Android and desktop: Google Calendar with everything prefilled
    const q=new URLSearchParams({action:"TEMPLATE",text:title,dates:`${stamp(start)}/${stamp(end)}`,details,location:where});
    window.open("https://calendar.google.com/calendar/render?"+q,"_blank","noopener");return}
  // iPhone, iPad, Mac: an .ics event that Apple Calendar offers to add
  const esc=t=>t.replace(/\\/g,"\\\\").replace(/([,;])/g,"\\$1").replace(/\n/g,"\\n");
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//wedding-invite//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",
    "UID:"+stamp(start)+"-"+e.name.replace(/\W+/g,"")+"@invite","DTSTAMP:"+stamp(new Date()),"DTSTART:"+stamp(start),"DTEND:"+stamp(end),
    "SUMMARY:"+esc(title),"LOCATION:"+esc(where),"DESCRIPTION:"+esc(details),"URL:"+mapUrl(e),
    "BEGIN:VALARM","TRIGGER:-P1D","ACTION:DISPLAY","DESCRIPTION:"+esc(title+" is tomorrow"),"END:VALARM",
    "BEGIN:VALARM","TRIGGER:-PT3H","ACTION:DISPLAY","DESCRIPTION:"+esc(title+" is today"),"END:VALARM",
    "END:VEVENT","END:VCALENDAR"].join("\r\n");
  const a=document.createElement("a");a.href="data:text/calendar;charset=utf-8,"+encodeURIComponent(ics);a.download=e.name.replace(/\W+/g,"-")+".ics";document.body.appendChild(a);a.click();a.remove()}
$$("[data-cal]").forEach(a=>a.addEventListener("click",ev=>{ev.preventDefault();addToCalendar(CONFIG.events.find(x=>x.name===a.dataset.cal)||main)}));

/* share */
$("#share").addEventListener("click",async e=>{const data={title:document.title,text:`Assalamu Alaikum! With the blessings of Allah, you are cordially invited to the Walima of ${CONFIG.groom} & ${CONFIG.bride}. Tap to open your invitation:`,url:CONFIG.siteUrl||location.origin+location.pathname};
  if(navigator.share){try{await navigator.share(data);return}catch(err){if(err.name==="AbortError")return}}
  try{await navigator.clipboard.writeText(data.url);e.target.textContent="Link copied"}catch(_){}});

})();
