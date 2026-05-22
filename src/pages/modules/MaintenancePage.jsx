import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import AppLayout from "../../layouts/AppLayout";

const EMPTY = { assetId:"", driverName:"", partSerialNo:"", cost:"", remarks:"" };

export default function MaintenancePage() {
  const { sheetId } = useParams();
  const { user }    = useAuth();
  const [records, setRecords]   = useState([]);
  const [assets, setAssets]     = useState([]);
  const [costData, setCostData] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [canDo, setCanDo]       = useState(new Set());
  const [tab, setTab]           = useState("LOG"); // LOG | COST
  const [assetFilter, setAssetFilter] = useState("");
  const [verFilter, setVerFilter]     = useState("ALL"); // ALL | VERIFIED | UNVERIFIED
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState(null);
  const [form, setForm]               = useState(EMPTY);
  const [formErr, setFormErr]         = useState("");
  const [saving, setSaving]           = useState(false);

  // Assets sheet ID stored separately — we need it to fetch assets list
  const [assetSheetId, setAssetSheetId] = useState(null);

  const fetch = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if(assetFilter) params.set("assetId", assetFilter);
      if(verFilter!=="ALL") params.set("verified", verFilter==="VERIFIED"?"true":"false");
      const [recs, costs] = await Promise.all([
        api.get(`/maintenance/${sheetId}?${params}`),
        api.get(`/maintenance/${sheetId}/cost-by-asset`),
      ]);
      setRecords(recs.data); setCostData(costs.data);
    } catch(e){ setError(e.response?.data?.message||"Failed"); }
    finally{ setLoading(false); }
  };

  useEffect(()=>{
    if(user?.role==="ADMIN") setCanDo(new Set(["READ","INPUT","EDIT","DELETE"]));
    else api.get("/sheets").then(r=>{const s=r.data.find(x=>x.id===sheetId);if(s?.actions)setCanDo(new Set(s.actions));}).catch(()=>{});
    // Load assets list + find assets sheetId
    api.get("/sheets").then(r=>{
      const assetSheet=r.data.find(s=>s.moduleKey==="assets");
      if(assetSheet){
        setAssetSheetId(assetSheet.id);
        return api.get(`/assets/${assetSheet.id}`);
      }
    }).then(r=>{ if(r) setAssets(r.data); }).catch(()=>{});
    fetch();
  }, [sheetId]);

  useEffect(()=>{ fetch(); }, [assetFilter, verFilter]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormErr(""); setShowModal(true); };
  const openEdit   = (r) => { setEditing(r); setForm({ assetId:r.assetId, driverName:r.driverName||"", partSerialNo:r.partSerialNo||"", cost:r.cost, remarks:r.remarks||"" }); setFormErr(""); setShowModal(true); };
  const close      = ()  => { setShowModal(false); setEditing(null); };
  const f = (v) => { const{name,value}=v.target; setForm(p=>({...p,[name]:value})); };

  const save = async (e) => {
    e.preventDefault(); setFormErr(""); setSaving(true);
    try {
      if(editing){ const r=await api.patch(`/maintenance/${sheetId}/${editing.id}`,form); setRecords(p=>p.map(x=>x.id===editing.id?r.data:x)); }
      else{ const r=await api.post(`/maintenance/${sheetId}`,form); setRecords(p=>[r.data,...p]); }
      close();
    } catch(e){ setFormErr(e.response?.data?.message||"Save failed"); }
    finally{ setSaving(false); }
  };

  const verify = async (rec) => {
    try{ const r=await api.patch(`/maintenance/${sheetId}/${rec.id}/verify`); setRecords(p=>p.map(x=>x.id===rec.id?r.data:x)); }
    catch(e){ alert(e.response?.data?.message||"Failed"); }
  };

  const del = async (rec) => {
    if(!confirm("Delete this maintenance record?")) return;
    try{ await api.delete(`/maintenance/${sheetId}/${rec.id}`); setRecords(p=>p.filter(x=>x.id!==rec.id)); }
    catch(e){ alert(e.response?.data?.message||"Failed"); }
  };

  const totalCost = records.reduce((s,r)=>s+parseFloat(r.cost),0);
  const unverified = records.filter(r=>!r.verified).length;

  return (
    <AppLayout title="Maintenance Log" subtitle="Asset repair and service records" actions={canDo.has("INPUT")&&<button className="btn btn-primary" onClick={openCreate}>+ Add Record</button>}>
      <div className="grid-4" style={{marginBottom:20}}>
        {[["Total Records",records.length,"var(--text)"],["Total Cost",`Rs. ${totalCost.toFixed(0)}`,`var(--accent)`],["Unverified",unverified,"var(--red)"],["Assets Tracked",costData.length,"var(--blue)"]].map(([l,v,c])=>(
          <div key={l} className="stat-card"><div className="stat-label">{l}</div><div className="stat-value" style={{color:c,fontSize:"1.4rem"}}>{v}</div></div>
        ))}
      </div>

      <div className="card" style={{padding:"10px 14px",marginBottom:14}}>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div className="tabs">
            {[["LOG","Repair Log"],["COST","Cost by Asset"]].map(([k,l])=><button key={k} className={`tab${tab===k?" active":""}`} onClick={()=>setTab(k)}>{l}</button>)}
          </div>
          {tab==="LOG"&&<>
            <select className="input" style={{width:180,padding:"5px 8px"}} value={assetFilter} onChange={e=>setAssetFilter(e.target.value)}>
              <option value="">All Assets</option>
              {assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select className="input" style={{width:140,padding:"5px 8px"}} value={verFilter} onChange={e=>setVerFilter(e.target.value)}>
              <option value="ALL">All Status</option>
              <option value="VERIFIED">Verified</option>
              <option value="UNVERIFIED">Unverified</option>
            </select>
          </>}
          <span style={{fontSize:"0.8rem",color:"var(--muted)",marginLeft:"auto"}}>{tab==="LOG"?records.length:costData.length} records</span>
        </div>
      </div>

      {error&&<div className="alert alert-error" style={{marginBottom:12}}>{error}</div>}
      {loading&&<div style={{textAlign:"center",padding:40,color:"var(--muted)"}}>Loading...</div>}

      {!loading&&tab==="COST"&&(
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Asset</th><th>Repair Count</th><th>Total Cost (Rs.)</th></tr></thead>
              <tbody>
                {costData.map(c=>(
                  <tr key={c.assetId}>
                    <td style={{fontWeight:600}}>{c.assetName}</td>
                    <td className="mono">{c.count}</td>
                    <td className="mono" style={{fontWeight:700,color:"var(--accent)"}}>Rs. {parseFloat(c.totalCost).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading&&tab==="LOG"&&records.length===0&&(
        <div className="card" style={{textAlign:"center",padding:48}}>
          <div style={{fontSize:"2.5rem",marginBottom:12}}>🔧</div>
          <p style={{color:"var(--muted)"}}>No maintenance records.</p>
          {canDo.has("INPUT")&&<button className="btn btn-primary" style={{marginTop:16}} onClick={openCreate}>Add First Record</button>}
        </div>
      )}

      {!loading&&tab==="LOG"&&records.length>0&&(
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Asset</th><th>Driver</th><th>Part Serial</th><th>Cost (Rs.)</th>
                <th>Remarks</th><th>Status</th><th>Date</th>
                {(canDo.has("EDIT")||canDo.has("DELETE"))&&<th style={{textAlign:"right"}}>Actions</th>}
              </tr></thead>
              <tbody>
                {records.map(r=>(
                  <tr key={r.id}>
                    <td><span style={{fontWeight:600}}>{r.asset?.name}</span><div style={{fontSize:"0.75rem",color:"var(--muted)"}}>{r.asset?.type}</div></td>
                    <td>{r.driverName||"—"}</td>
                    <td className="mono">{r.partSerialNo||"—"}</td>
                    <td className="mono" style={{fontWeight:700,color:"var(--accent)"}}>Rs. {parseFloat(r.cost).toLocaleString()}</td>
                    <td style={{color:"var(--muted)",fontSize:"0.82rem",maxWidth:160}}>{r.remarks||"—"}</td>
                    <td>
                      {r.verified
                        ? <span className="badge badge-green">✓ Verified</span>
                        : <span className="badge badge-amber">Pending</span>}
                    </td>
                    <td className="mono" style={{fontSize:"0.82rem"}}>{new Date(r.createdAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</td>
                    {(canDo.has("EDIT")||canDo.has("DELETE"))&&(
                      <td style={{textAlign:"right"}}>
                        <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                          {canDo.has("EDIT")&&!r.verified&&<button className="btn btn-ghost btn-sm" style={{color:"var(--green)"}} onClick={()=>verify(r)}>Verify</button>}
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
              <h2 className="modal-title" style={{marginBottom:0}}>{editing?"Edit Record":"Add Maintenance Record"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={close}>✕</button>
            </div>
            {formErr&&<div className="alert alert-error" style={{marginBottom:14}}>{formErr}</div>}
            <form onSubmit={save}>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div className="form-group"><label className="label">Asset *</label>
                  <select className="input" name="assetId" value={form.assetId} onChange={f} required>
                    <option value="">Select asset...</option>
                    {assets.map(a=><option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="form-group"><label className="label">Driver / Operator</label><input className="input" name="driverName" value={form.driverName} onChange={f}/></div>
                  <div className="form-group"><label className="label">Part Serial No.</label><input className="input" name="partSerialNo" value={form.partSerialNo} onChange={f}/></div>
                </div>
                <div className="form-group"><label className="label">Repair Cost (Rs.) *</label><input className="input" name="cost" type="number" step="0.01" min="0" value={form.cost} onChange={f} required/></div>
                <div className="form-group"><label className="label">Remarks / Description</label><textarea className="input" name="remarks" value={form.remarks} onChange={f} rows={3} style={{resize:"vertical"}} placeholder="Describe the repair work done..."/></div>
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