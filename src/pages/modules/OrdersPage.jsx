import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import AppLayout from "../../layouts/AppLayout";

const today = () => new Date().toISOString().split("T")[0];
const EMPTY = { productName:"", productCode:"", size:"", quantity:"", details:"", usedFor:"", orderedBy:"", orderPlacedAt:today(), receivedAt:"", remarks:"", comments:"" };

const STATUS_STYLE = { PENDING:{cls:"badge-amber",label:"Pending"}, DELIVERED:{cls:"badge-green",label:"Delivered"} };

export default function OrdersPage() {
  const { sheetId } = useParams();
  const { user }    = useAuth();
  const [orders, setOrders]     = useState([]);
  const [stats, setStats]       = useState({total:0,pending:0,delivered:0});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [canDo, setCanDo]       = useState(new Set());
  const [filter, setFilter]     = useState("ALL"); // ALL | PENDING | DELIVERED
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [formErr, setFormErr]     = useState("");
  const [saving, setSaving]       = useState(false);

  const fetch = async () => {
    try {
      setLoading(true);
      const params = filter!=="ALL"?`?status=${filter}`:"";
      const [ord, st] = await Promise.all([api.get(`/orders/${sheetId}${params}`), api.get(`/orders/${sheetId}/stats`)]);
      setOrders(ord.data); setStats(st.data);
    } catch(e){ setError(e.response?.data?.message||"Failed"); }
    finally{ setLoading(false); }
  };

  useEffect(()=>{
    if(user?.role==="ADMIN") setCanDo(new Set(["READ","INPUT","EDIT","DELETE"]));
    else api.get("/sheets").then(r=>{const s=r.data.find(x=>x.id===sheetId);if(s?.actions)setCanDo(new Set(s.actions));}).catch(()=>{});
    fetch();
  }, [sheetId, filter]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormErr(""); setShowModal(true); };
  const openEdit   = (o) => { setEditing(o); setForm({ productName:o.productName, productCode:o.productCode||"", size:o.size||"", quantity:o.quantity, details:o.details||"", usedFor:o.usedFor||"", orderedBy:o.orderedBy, orderPlacedAt:o.orderPlacedAt?.split("T")[0]||today(), receivedAt:o.receivedAt?.split("T")[0]||"", remarks:o.remarks||"", comments:o.comments||"" }); setFormErr(""); setShowModal(true); };
  const close      = ()  => { setShowModal(false); setEditing(null); };
  const f = (v) => { const{name,value}=v.target; setForm(p=>({...p,[name]:value})); };

  const save = async (e) => {
    e.preventDefault(); setFormErr(""); setSaving(true);
    try {
      if(editing){ const r=await api.patch(`/orders/${sheetId}/${editing.id}`,form); setOrders(p=>p.map(x=>x.id===editing.id?r.data:x)); }
      else{ const r=await api.post(`/orders/${sheetId}`,form); setOrders(p=>[r.data,...p]); }
      close(); fetch();
    } catch(e){ setFormErr(e.response?.data?.message||"Save failed"); }
    finally{ setSaving(false); }
  };

  const deliver = async (order) => {
    if(!confirm(`Mark "${order.productName}" as delivered?`)) return;
    try { const r=await api.patch(`/orders/${sheetId}/${order.id}/deliver`); setOrders(p=>p.map(x=>x.id===order.id?r.data:x)); fetch(); }
    catch(e){ alert(e.response?.data?.message||"Failed"); }
  };

  const del = async (order) => {
    if(!confirm(`Delete order for "${order.productName}"?`)) return;
    try{ await api.delete(`/orders/${sheetId}/${order.id}`); setOrders(p=>p.filter(x=>x.id!==order.id)); fetch(); }
    catch(e){ alert(e.response?.data?.message||"Failed"); }
  };

  return (
    <AppLayout title="Order List" subtitle="Customer orders and delivery tracking" actions={canDo.has("INPUT")&&<button className="btn btn-primary" onClick={openCreate}>+ New Order</button>}>
      <div className="grid-3" style={{marginBottom:20}}>
        {[["Total Orders",stats.total,"var(--text)"],["Pending",stats.pending,"var(--accent)"],["Delivered",stats.delivered,"var(--green)"]].map(([l,v,c])=>(
          <div key={l} className="stat-card" style={{cursor:"pointer"}} onClick={()=>setFilter(l==="Total Orders"?"ALL":l.toUpperCase())}>
            <div className="stat-label">{l}</div><div className="stat-value" style={{color:c}}>{v}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{padding:"10px 14px",marginBottom:14}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div className="tabs">
            {["ALL","PENDING","DELIVERED"].map(t=><button key={t} className={`tab${filter===t?" active":""}`} onClick={()=>setFilter(t)}>{t}</button>)}
          </div>
          <span style={{fontSize:"0.8rem",color:"var(--muted)",marginLeft:"auto"}}>{orders.length} orders</span>
        </div>
      </div>

      {error&&<div className="alert alert-error" style={{marginBottom:12}}>{error}</div>}
      {loading&&<div style={{textAlign:"center",padding:40,color:"var(--muted)"}}>Loading...</div>}

      {!loading&&orders.length===0&&(
        <div className="card" style={{textAlign:"center",padding:48}}>
          <div style={{fontSize:"2.5rem",marginBottom:12}}>📋</div>
          <p style={{color:"var(--muted)"}}>No orders found.</p>
          {canDo.has("INPUT")&&<button className="btn btn-primary" style={{marginTop:16}} onClick={openCreate}>Create First Order</button>}
        </div>
      )}

      {!loading&&orders.length>0&&(
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Product</th><th>Size/Code</th><th>Qty</th><th>Ordered By</th>
                <th>Order Date</th><th>Delivery Date</th><th>Status</th>
                {(canDo.has("EDIT")||canDo.has("DELETE"))&&<th style={{textAlign:"right"}}>Actions</th>}
              </tr></thead>
              <tbody>
                {orders.map(o=>{
                  const status = o.receivedAt?"DELIVERED":"PENDING";
                  const st = STATUS_STYLE[status];
                  return (
                    <tr key={o.id}>
                      <td><span style={{fontWeight:600}}>{o.productName}</span>{o.usedFor&&<div style={{fontSize:"0.75rem",color:"var(--muted)"}}>For: {o.usedFor}</div>}</td>
                      <td style={{color:"var(--muted)",fontSize:"0.82rem"}}>{[o.productCode,o.size].filter(Boolean).join(" / ")||"—"}</td>
                      <td className="mono" style={{fontWeight:700}}>{parseFloat(o.quantity).toFixed(2)}</td>
                      <td>{o.orderedBy}</td>
                      <td className="mono">{new Date(o.orderPlacedAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</td>
                      <td className="mono">{o.receivedAt ? new Date(o.receivedAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : <span style={{color:"var(--muted)"}}>Pending</span>}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      {(canDo.has("EDIT")||canDo.has("DELETE"))&&(
                        <td style={{textAlign:"right"}}>
                          <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                            {canDo.has("EDIT")&&!o.receivedAt&&<button className="btn btn-ghost btn-sm" style={{color:"var(--green)"}} onClick={()=>deliver(o)}>✓ Delivered</button>}
                            {canDo.has("EDIT")&&<button className="btn btn-ghost btn-sm" onClick={()=>openEdit(o)}>Edit</button>}
                            {canDo.has("DELETE")&&<button className="btn btn-danger btn-sm" onClick={()=>del(o)}>Delete</button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal&&(
        <div className="modal-overlay" onClick={close}>
          <div className="modal" style={{maxWidth:560}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 className="modal-title" style={{marginBottom:0}}>{editing?"Edit Order":"New Order"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={close}>✕</button>
            </div>
            {formErr&&<div className="alert alert-error" style={{marginBottom:14}}>{formErr}</div>}
            <form onSubmit={save}>
              <div className="grid-2" style={{gap:14}}>
                <div className="form-group" style={{gridColumn:"1/-1"}}><label className="label">Product Name *</label><input className="input" name="productName" value={form.productName} onChange={f} required placeholder="e.g. Gitti 20mm"/></div>
                <div className="form-group"><label className="label">Product Code</label><input className="input" name="productCode" value={form.productCode} onChange={f}/></div>
                <div className="form-group"><label className="label">Size/Grade</label><input className="input" name="size" value={form.size} onChange={f} placeholder="e.g. 20mm"/></div>
                <div className="form-group"><label className="label">Quantity *</label><input className="input" name="quantity" type="number" step="0.01" min="0.01" value={form.quantity} onChange={f} required/></div>
                <div className="form-group"><label className="label">Ordered By *</label><input className="input" name="orderedBy" value={form.orderedBy} onChange={f} required placeholder="Customer name"/></div>
                <div className="form-group"><label className="label">Order Date *</label><input className="input" name="orderPlacedAt" type="date" value={form.orderPlacedAt} onChange={f} required/></div>
                <div className="form-group"><label className="label">Delivery Date</label><input className="input" name="receivedAt" type="date" value={form.receivedAt} onChange={f}/></div>
                <div className="form-group" style={{gridColumn:"1/-1"}}><label className="label">Used For</label><input className="input" name="usedFor" value={form.usedFor} onChange={f} placeholder="Purpose / project"/></div>
                <div className="form-group"><label className="label">Remarks</label><textarea className="input" name="remarks" value={form.remarks} onChange={f} rows={2} style={{resize:"vertical"}}/></div>
                <div className="form-group"><label className="label">Comments</label><textarea className="input" name="comments" value={form.comments} onChange={f} rows={2} style={{resize:"vertical"}}/></div>
              </div>
              <div style={{display:"flex",gap:10,marginTop:20}}>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{flex:1}}>{saving?"Saving...":editing?"Save Changes":"Create Order"}</button>
                <button type="button" className="btn btn-ghost" onClick={close} disabled={saving}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}