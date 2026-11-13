"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type CommunityEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  meeting_url: string;
};

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
const localInput = (date: Date) => {
  const pad = (n:number) => String(n).padStart(2,"0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function CommunityCalendar({ isAdmin }: { isAdmin: boolean }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/member-portal/content?month=${monthKey(month)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Calendar unavailable.");
      setEvents(data.events ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load the community calendar.");
    } finally { setLoading(false); }
  }, [month]);

  useEffect(() => { void refresh(); }, [refresh]);

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth()+1, 0);
  const startOffset = (monthStart.getDay()+6)%7;
  const days = Array.from({length:Math.ceil((startOffset+monthEnd.getDate())/7)*7},(_,i)=>{
    const date = new Date(month.getFullYear(),month.getMonth(),i-startOffset+1);
    return {date,inMonth:date.getMonth()===month.getMonth()};
  });
  const [selectedDay,setSelectedDay] = useState(() => new Date().getDate());
  const selectedEvents = useMemo(()=>events.filter(event=>{
    const date = new Date(event.starts_at);
    return date.getFullYear()===month.getFullYear() && date.getMonth()===month.getMonth() && date.getDate()===selectedDay;
  }),[events,month,selectedDay]);
  const upcoming = useMemo(()=>[...events].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)),[events]);

  function resetForm() {
    setEditingId(""); setTitle(""); setDescription(""); setMeetingUrl("");
    const start = new Date(); start.setDate(start.getDate()+1); start.setHours(10,0,0,0);
    const end = new Date(start); end.setMinutes(end.getMinutes()+60);
    setStartsAt(localInput(start)); setEndsAt(localInput(end));
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/member-portal/admin",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"event_upsert",id:editingId,title,description,meetingUrl,startsAt:new Date(startsAt).toISOString(),endsAt:new Date(endsAt).toISOString()}),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || "Unable to save meeting.");
      setMessage("Community meeting saved and added to the calendar.");
      resetForm(); await refresh();
    } catch(error) { setMessage(error instanceof Error?error.message:"Unable to save meeting."); }
    finally { setSaving(false); }
  }

  function editEvent(event: CommunityEvent) {
    setEditingId(event.id); setTitle(event.title); setDescription(event.description ?? "");
    setMeetingUrl(event.meeting_url); setStartsAt(localInput(new Date(event.starts_at))); setEndsAt(localInput(new Date(event.ends_at)));
    setMessage("");
  }

  async function deleteEvent(id:string) {
    if(!window.confirm("Remove this community meeting from the calendar?")) return;
    const response=await fetch("/api/member-portal/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"event_delete",id})});
    const data=await response.json();
    if(!response.ok){setMessage(data.error||"Unable to remove meeting.");return;}
    setMessage("Meeting removed."); await refresh();
  }

  return <section className="vt-community-calendar">
    <div className="vt-community-calendar-head">
      <div><span className="vt-member-kicker">LIVE COMMUNITY SCHEDULE</span><h2>Google Meet calendar</h2><p>Scheduled member sessions for the selected month. Times are shown in South African time.</p></div>
      <div className="vt-calendar-month-switch"><button type="button" onClick={()=>{setSelectedDay(1);setMonth(new Date(month.getFullYear(),month.getMonth()-1,1));}} aria-label="Previous month">‹</button><strong>{month.toLocaleDateString("en-ZA",{month:"long",year:"numeric"})}</strong><button type="button" onClick={()=>{setSelectedDay(1);setMonth(new Date(month.getFullYear(),month.getMonth()+1,1));}} aria-label="Next month">›</button></div>
    </div>
    <div className="vt-calendar-grid">
      {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day=><div className="vt-calendar-weekday" key={day}>{day}</div>)}
      {days.map(({date,inMonth},index)=>{
        const dayEvents=events.filter(event=>{const d=new Date(event.starts_at);return d.getFullYear()===date.getFullYear()&&d.getMonth()===date.getMonth()&&d.getDate()===date.getDate();});
        const today=new Date();
        const isToday=date.toDateString()===today.toDateString();
        return <button type="button" key={index} className={["vt-calendar-day",!inMonth?"outside":"",isToday?"today":"",selectedDay===date.getDate()&&inMonth?"selected":""].filter(Boolean).join(" ")} disabled={!inMonth} onClick={()=>setSelectedDay(date.getDate())}>
          <span>{date.getDate()}</span>{dayEvents.length>0&&<i>{dayEvents.length} {dayEvents.length===1?"session":"sessions"}</i>}
        </button>;
      })}
    </div>
    <div className="vt-calendar-day-events">
      <h3>{new Date(month.getFullYear(),month.getMonth(),selectedDay).toLocaleDateString("en-ZA",{weekday:"long",day:"numeric",month:"long"})}</h3>
      {selectedEvents.length ? selectedEvents.map(event=><article className="vt-calendar-event" key={event.id}>
        <div><span>{new Date(event.starts_at).toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})} – {new Date(event.ends_at).toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}</span><strong>{event.title}</strong>{event.description&&<p>{event.description}</p>}</div>
        <a className="vt-member-button" href={event.meeting_url} target="_blank" rel="noreferrer">Join Google Meet ↗</a>
        {isAdmin&&<div className="vt-calendar-admin-actions"><button type="button" onClick={()=>editEvent(event)}>Edit</button><button type="button" onClick={()=>void deleteEvent(event.id)}>Remove</button></div>}
      </article>):<p className="vt-member-note">No meeting has been scheduled for this day yet.</p>}
    </div>
    <div className="vt-calendar-announcement">
      <span className="vt-member-kicker">CURRENT GOOGLE MEET ANNOUNCEMENT · LIVE COMMUNITY LINKS</span>
      {upcoming.length ? upcoming.slice(0,3).map(event=><div className="vt-calendar-announcement-row" key={event.id}><div><strong>{event.title}</strong><small>{new Date(event.starts_at).toLocaleString("en-ZA",{dateStyle:"medium",timeStyle:"short"})} (SAST)</small></div><a href={event.meeting_url} target="_blank" rel="noreferrer">Open meeting ↗</a></div>):<p>No upcoming Google Meet has been published yet. Check back after the administrator schedules a session.</p>}
    </div>
    {isAdmin&&<div className="vt-calendar-admin-form">
      <div><span className="vt-member-kicker">ADMINISTRATOR</span><h3>{editingId?"Edit community meeting":"Add a community meeting"}</h3><p>Add the meeting name, date/time and Google Meet link. It will appear in the member calendar and current announcement list.</p></div>
      <form className="vt-member-form" onSubmit={saveEvent}>
        <label>Meeting name<input required value={title} onChange={e=>setTitle(e.target.value)} maxLength={140} placeholder="e.g. VaultTrades Weekly Community Meet"/></label>
        <label>Meeting description<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2} maxLength={1000} placeholder="What members should prepare or expect"/></label>
        <div className="vt-calendar-time-fields"><label>Start date & time<input required type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)}/></label><label>End date & time<input required type="datetime-local" value={endsAt} onChange={e=>setEndsAt(e.target.value)}/></label></div>
        <label>Google Meet link<input required type="url" value={meetingUrl} onChange={e=>setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/..."/></label>
        <div className="vt-calendar-form-actions"><button className="vt-member-button" type="submit" disabled={saving}>{saving?"Saving…":editingId?"Update meeting":"Publish meeting"}</button>{editingId&&<button type="button" className="vt-member-outline" onClick={resetForm}>Cancel edit</button>}</div>
      </form>
    </div>}
    {message&&<p className="vt-member-submit-message" role="status">{message}</p>}
    {loading&&<p className="vt-member-form-note">Loading calendar…</p>}
  </section>;
}
