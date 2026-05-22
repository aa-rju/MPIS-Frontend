import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import AppLayout from "../../layouts/AppLayout";

const today = () => new Date().toISOString().split("T")[0];
const EMPTY = { materialName:"", quantity:"", vehicleNo:"", remarks:"", recordedAt:today() };

export default function RawMaterialPage() {
  const { sheetId } = useParams();
  const { user }    = useAuth();
  const [records, setRecords]   = useState([]);
  const [summary, setSummary]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [canDo, setCanDo]       = useState(new Set());
  const [tab, setTab]           = useState("LOG"); // LOG | SUMMARY
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [formErr, setFormErr]     = useState("");
  const [saving, setSaving]       = useState(false);
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");

  const fetch = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if(dateFrom) params.set("from", dateFrom);
      if(dateTo)   params.set("to", dateTo);
      const [recs, sum] = await Promise.all([
        api.get(`/rawmaterial/${sheetId}?${params}`),
        api.get(`/rawmaterial/${sheetId}/summary?${params}`),
      ]);
      setRecords(recs.data); setSummary(sum.data);
    } catch(e) { setError(e.response?.data?.message||"Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if(user?.role==="ADMIN") setCanDo(new Set(["READ","INPUT","EDIT","DELETE"]));
    else api.get("/sheets").then(r=>{const s=r.data.find(x=>x.id===sheetId);if(s?.actions)setCanDo(new Set(s.actions));}).catch(()=>{});
    fetch();
  }, [sheetId, dateFrom, dateTo]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormErr(""); setShowModal(true); };
  const openEdit   = (r) => { setEditing(r); setForm({ materialName:r.materialName, quantity:r.quantity, vehicleNo:r.vehicleNo||"", remarks:r.remarks||"", recordedAt:r.recordedAt.split("T")[0] }); setFormErr(""); setShowModal(true); };
  const close      = ()  => { setShowModal(false); setEditing(null); };
  const f = (v) => { const{name,value}=v.target; setForm(p=>({...p,[name]:value})); };

  const save = async (e) => {
    e.preventDefault(); setFormErr(""); setSaving(true);
    try {
      if(editing){ const r=await api.patch(`/rawmaterial/${sheetId}/${editing.id}`,form); setRecords(p=>p.map(x=>x.id===editing.id?r.data:x)); }
      else { const r=await api.post(`/rawmaterial/${sheetId}`,form); setRecords(p=>[r.data,...p]); }
      close(); fetch();
    } catch(e){ setFormErr(e.response?.data?.message||"Save failed"); }
    finally{ setSaving(false); }
  };

  const del = async (rec) => {
    if(!confirm("Delete this record?")) return;
    try { await api.delete(`/rawmaterial/${sheetId}/${rec.id}`); setRecords(p=>p.filter(x=>x.id!==rec.id)); fetch(); }
    catch(e){ alert(e.response?.data?.message||"Failed"); }
  };

  const totalQty = records.reduce((s,r)=>s+parseFloat(r.quantity),0);

  return (
    <AppLayout title="Raw Material" subtitle="Incoming stone, sand & gitti delivery log" actions={canDo.has("INPUT")&&<button className="btn btn-primary" onClick={openCreate}>+ Add Record</button>}>
      <div className="grid-3" style={{marginBottom:20}}>
        {[["Total Deliveries",records.length,"var(--text)"],["Total Quantity",`${totalQty.toFixed(2)} tons`,"var(--accent)"],["Material Types",summary.length,"var(--blue)"]].map(([l,v,c])=>(
          <div key={l} className="stat-card"><div className="stat-label">{l}</div><div className="stat-value" style={{color:c,fontSize:"1.5rem"}}>{v}</div></div>
        ))}
      </div>

      {/* Date filter + tabs */}
      <div className="card" style={{padding:"10px 14px",marginBottom:14}}>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div className="tabs">
            {[["LOG","Delivery Log"],["SUMMARY","Summary by Material"]].map(([k,l])=>
              <button key={k} className={`tab${tab===k?" active":""}`} onClick={()=>setTab(k)}>{l}</button>
            )}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",fontSize:"0.82rem",color:"var(--muted)"}}>
            <span>From:</span><input type="date" className="input" style={{width:140,padding:"5px 8px"}} value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
            <span>To:</span><input type="date" className="input" style={{width:140,padding:"5px 8px"}} value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
            {(dateFrom||dateTo)&&<button className="btn btn-ghost btn-sm" onClick={()=>{setDateFrom("");setDateTo("");}}>Clear</button>}
          </div>
        </div>
      </div>

      {error&&<div className="alert alert-error" style={{marginBottom:12}}>{error}</div>}
      {loading&&<div style={{textAlign:"center",padding:40,color:"var(--muted)"}}>Loading...</div>}

      {!loading&&tab==="SUMMARY"&&(
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Material</th><th>Total Quantity (tons)</th><th>Share</th></tr></thead>
              <tbody>
                {summary.map(s=>(
                  <tr key={s.material}>
                    <td style={{fontWeight:600}}>{s.material}</td>
                    <td className="mono" style={{fontWeight:700,color:"var(--accent)"}}>{parseFloat(s.total).toFixed(2)}</td>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:100,height:6,background:"var(--border2)",borderRadius:3}}>
                          <div style={{width:`${totalQty>0?(parseFloat(s.total)/totalQty*100):0}%`,height:"100%",background:"var(--accent)",borderRadius:3}}/>
                        </div>
                        <span style={{fontSize:"0.8rem",color:"var(--muted)"}}>{totalQty>0?(parseFloat(s.total)/totalQty*100).toFixed(1):0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading&&tab==="LOG"&&records.length===0&&(
        <div className="card" style={{textAlign:"center",padding:48}}>
          <div style={{fontSize:"2.5rem",marginBottom:12}}>⚙️</div>
          <p style={{color:"var(--muted)"}}>No delivery records found.</p>
          {canDo.has("INPUT")&&<button className="btn btn-primary" style={{marginTop:16}} onClick={openCreate}>Add First Record</button>}
        </div>
      )}

      {!loading&&tab==="LOG"&&records.length>0&&(
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Date</th><th>Material</th><th>Quantity (tons)</th><th>Vehicle No.</th><th>Remarks</th>
                {(canDo.has("EDIT")||canDo.has("DELETE"))&&<th style={{textAlign:"right"}}>Actions</th>}
              </tr></thead>
              <tbody>
                {records.map(r=>(
                  <tr key={r.id}>
                    <td className="mono" style={{whiteSpace:"nowrap"}}>{new Date(r.recordedAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</td>
                    <td style={{fontWeight:600}}>{r.materialName}</td>
                    <td className="mono" style={{fontWeight:700,color:"var(--accent)"}}>{parseFloat(r.quantity).toFixed(2)}</td>
                    <td className="mono">{r.vehicleNo||"—"}</td>
                    <td style={{color:"var(--muted)",fontSize:"0.82rem"}}>{r.remarks||"—"}</td>
                    {(canDo.has("EDIT")||canDo.has("DELETE"))&&(
                      <td style={{textAlign:"right"}}>
                        <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                          {canDo.has("EDIT")&&<button className="btn btn-ghost btn-sm" onClick={()=>openEdit(r)}>Edit</button>}
                          {canDo.has("DELETE")&&<button className="btn btn-danger btn-sm" onClick={()=>del(r)}>Delete</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal&&(
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 className="modal-title" style={{marginBottom:0}}>{editing?"Edit Record":"Add Delivery Record"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={close}>✕</button>
            </div>
            {formErr&&<div className="alert alert-error" style={{marginBottom:14}}>{formErr}</div>}
            <form onSubmit={save}>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div className="form-group"><label className="label">Material Name *</label><input className="input" name="materialName" value={form.materialName} onChange={f} required placeholder="e.g. Gitti 20mm, Sand, Stone Dust"/></div>
                <div className="grid-2">
                  <div className="form-group"><label className="label">Quantity (tons) *</label><input className="input" name="quantity" type="number" step="0.01" min="0.01" value={form.quantity} onChange={f} required/></div>
                  <div className="form-group"><label className="label">Vehicle No.</label><input className="input" name="vehicleNo" value={form.vehicleNo} onChange={f} placeholder="e.g. Ba 1 Ja 1234"/></div>
                </div>
                <div className="form-group"><label className="label">Date *</label><input className="input" name="recordedAt" type="date" value={form.recordedAt} onChange={f} required/></div>
                <div className="form-group"><label className="label">Remarks</label><textarea className="input" name="remarks" value={form.remarks} onChange={f} rows={2} style={{resize:"vertical"}}/></div>
              </div>
              <div style={{display:"flex",gap:10,marginTop:20}}>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{flex:1}}>{saving?"Saving...":editing?"Save Changes":"Add Record"}</button>
                <button type="button" className="btn btn-ghost" onClick={close} disabled={saving}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}