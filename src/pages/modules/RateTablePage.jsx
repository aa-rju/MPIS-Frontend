import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import AppLayout from "../../layouts/AppLayout";

const EMPTY = { name:"", enteredRate:"", isInternal:false };

export default function RateTablePage() {
  const { sheetId } = useParams();
  const { user }    = useAuth();
  const [rates, setRates]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [canDo, setCanDo]       = useState(new Set());
  const [showAll, setShowAll]   = useState(false);
  const [tab, setTab]           = useState("EXTERNAL"); // EXTERNAL | INTERNAL | ALL
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [formErr, setFormErr]     = useState("");
  const [saving, setSaving]       = useState(false);

  const fetch = async () => {
    try { setLoading(true); const r = await api.get(`/rates/${sheetId}${showAll?"?all=true":""}`); setRates(r.data); }
    catch(e) { setError(e.response?.data?.message||"Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if(user?.role==="ADMIN") setCanDo(new Set(["READ","INPUT","EDIT","DELETE"]));
    else api.get("/sheets").then(r=>{const s=r.data.find(x=>x.id===sheetId);if(s?.actions)setCanDo(new Set(s.actions));}).catch(()=>{});
    fetch();
  }, [sheetId, showAll]);

  const displayed = rates.filter(r => tab==="ALL" || (tab==="INTERNAL" ? r.isInternal : !r.isInternal));
  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormErr(""); setShowModal(true); };
  const openEdit   = (r) => { setEditing(r); setForm({ name:r.name, enteredRate:r.enteredRate, isInternal:r.isInternal }); setFormErr(""); setShowModal(true); };
  const close      = ()  => { setShowModal(false); setEditing(null); };
  const f = (v) => { const{name,value,type,checked}=v.target; setForm(p=>({...p,[name]:type==="checkbox"?checked:value})); };

  const save = async (e) => {
    e.preventDefault(); setFormErr(""); setSaving(true);
    try {
      if(editing){ const r=await api.patch(`/rates/${sheetId}/${editing.id}`,form); setRates(p=>p.map(x=>x.id===editing.id?r.data:x)); }
      else { const r=await api.post(`/rates/${sheetId}`,form); setRates(p=>[r.data,...p]); }
      close();
    } catch(e){ setFormErr(e.response?.data?.message||"Save failed"); }
    finally{ setSaving(false); }
  };

  const deactivate = async (rate) => {
    if(!confirm(`Deactivate rate for "${rate.name}"?`)) return;
    try { await api.delete(`/rates/${sheetId}/${rate.id}`); setRates(p=>p.filter(x=>x.id!==rate.id)); }
    catch(e){ alert(e.response?.data?.message||"Failed"); }
  };

  return (
    <AppLayout title="Rate Table" subtitle="Product pricing with VAT (13%)" actions={canDo.has("INPUT")&&<button className="btn btn-primary" onClick={openCreate}>+ Add Rate</button>}>
      <div className="grid-3" style={{marginBottom:20}}>
        {[["Total Rates",rates.length,"var(--text)"],["External Rates",rates.filter(r=>!r.isInternal).length,"var(--green)"],["Internal Rates",rates.filter(r=>r.isInternal).length,"var(--blue)"]].map(([l,v,c])=>(
          <div key={l} className="stat-card"><div className="stat-label">{l}</div><div className="stat-value" style={{color:c}}>{v}</div></div>
        ))}
      </div>

      <div className="card" style={{padding:"10px 14px",marginBottom:14}}>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div className="tabs">
            {[["EXTERNAL","External"],["INTERNAL","Internal"],["ALL","All"]].map(([k,l])=>
              <button key={k} className={`tab${tab===k?" active":""}`} onClick={()=>setTab(k)}>{l}</button>
            )}
          </div>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:"0.82rem",color:"var(--muted)",cursor:"pointer"}}>
            <input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/> Show inactive
          </label>
          <span style={{fontSize:"0.8rem",color:"var(--muted)"}}>{displayed.length} rates</span>
        </div>
      </div>

      {error&&<div className="alert alert-error" style={{marginBottom:12}}>{error}</div>}
      {loading&&<div style={{textAlign:"center",padding:40,color:"var(--muted)"}}>Loading...</div>}

      {!loading&&displayed.length===0&&(
        <div className="card" style={{textAlign:"center",padding:48}}>
          <div style={{fontSize:"2.5rem",marginBottom:12}}>💰</div>
          <p style={{color:"var(--muted)"}}>No rates found.</p>
          {canDo.has("INPUT")&&<button className="btn btn-primary" style={{marginTop:16}} onClick={openCreate}>Add First Rate</button>}
        </div>
      )}

      {!loading&&displayed.length>0&&(
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Product Name</th><th>Type</th><th>Entered Rate</th>
                <th>Taxable Amount</th><th>VAT (13%)</th><th>Total (incl. VAT)</th><th>Status</th>
                {(canDo.has("EDIT")||canDo.has("DELETE"))&&<th style={{textAlign:"right"}}>Actions</th>}
              </tr></thead>
              <tbody>
                {displayed.map(r=>(
                  <tr key={r.id} style={!r.isActive?{opacity:0.5}:{}}>
                    <td style={{fontWeight:600}}>{r.name}</td>
                    <td><span className={`badge ${r.isInternal?"badge-blue":"badge-green"}`}>{r.isInternal?"Internal":"External"}</span></td>
                    <td className="mono">Rs. {parseFloat(r.enteredRate).toFixed(2)}</td>
                    <td className="mono">Rs. {parseFloat(r.taxableAmount).toFixed(2)}</td>
                    <td className="mono" style={{color:"var(--amber)"}}>Rs. {parseFloat(r.vatAmount).toFixed(2)}</td>
                    <td className="mono" style={{fontWeight:700,color:"var(--accent)"}}>Rs. {(parseFloat(r.enteredRate)+parseFloat(r.vatAmount)).toFixed(2)}</td>
                    <td><span className={`badge ${r.isActive?"badge-green":"badge-gray"}`}>{r.isActive?"Active":"Inactive"}</span></td>
                    {(canDo.has("EDIT")||canDo.has("DELETE"))&&(
                      <td style={{textAlign:"right"}}>
                        <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                          {canDo.has("EDIT")&&r.isActive&&<button className="btn btn-ghost btn-sm" onClick={()=>openEdit(r)}>Edit</button>}
                          {canDo.has("DELETE")&&r.isActive&&<button className="btn btn-danger btn-sm" onClick={()=>deactivate(r)}>Deactivate</button>}
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
              <h2 className="modal-title" style={{marginBottom:0}}>{editing?"Edit Rate":"Add Rate"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={close}>✕</button>
            </div>
            {formErr&&<div className="alert alert-error" style={{marginBottom:14}}>{formErr}</div>}
            {/* Live VAT preview */}
            {form.enteredRate&&(
              <div className="card" style={{marginBottom:16,padding:"10px 14px",background:"var(--accent-dim)"}}>
                <div style={{fontSize:"0.78rem",color:"var(--accent)",fontWeight:600}}>VAT Preview (13%)</div>
                <div style={{display:"flex",gap:20,marginTop:6,fontSize:"0.875rem"}}>
                  <span>Base: Rs. {parseFloat(form.enteredRate||0).toFixed(2)}</span>
                  <span>VAT: Rs. {(parseFloat(form.enteredRate||0)*0.13).toFixed(2)}</span>
                  <span style={{fontWeight:700}}>Total: Rs. {(parseFloat(form.enteredRate||0)*1.13).toFixed(2)}</span>
                </div>
              </div>
            )}
            <form onSubmit={save}>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div className="form-group"><label className="label">Product Name *</label><input className="input" name="name" value={form.name} onChange={f} required placeholder="e.g. Gitti (20mm)"/></div>
                <div className="form-group"><label className="label">Entered Rate (Rs.) *</label><input className="input" name="enteredRate" type="number" step="0.01" min="0" value={form.enteredRate} onChange={f} required/></div>
                <div className="form-group">
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                    <input type="checkbox" name="isInternal" checked={form.isInternal} onChange={f}/>
                    <span className="label" style={{marginBottom:0}}>Internal rate (used inside plant)</span>
                  </label>
                </div>
              </div>
              <div style={{display:"flex",gap:10,marginTop:20}}>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{flex:1}}>{saving?"Saving...":editing?"Save Changes":"Add Rate"}</button>
                <button type="button" className="btn btn-ghost" onClick={close} disabled={saving}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}