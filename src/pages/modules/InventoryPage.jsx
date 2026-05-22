import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import AppLayout from "../../layouts/AppLayout";

const EMPTY = { name:"", category:"", stock:"", reorderLevel:"", location:"", serialNo:"", supplier:"", buyingRate:"", sellingRate:"", remarks:"" };

export default function InventoryPage() {
  const { sheetId } = useParams();
  const { user } = useAuth();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [canDo, setCanDo]       = useState(new Set());
  const [search, setSearch]     = useState("");
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState(null);
  const [form, setForm]               = useState(EMPTY);
  const [formErr, setFormErr]         = useState("");
  const [saving, setSaving]           = useState(false);
  const [tab, setTab]                 = useState("ALL"); // ALL | LOW

  const fetch = async () => {
    try { setLoading(true); const r = await api.get(`/inventory/${sheetId}`); setItems(r.data); }
    catch(e) { setError(e.response?.data?.message || "Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (user?.role === "ADMIN") setCanDo(new Set(["READ","INPUT","EDIT","DELETE"]));
    else api.get("/sheets").then(r => { const s = r.data.find(x => x.id===sheetId); if(s?.actions) setCanDo(new Set(s.actions)); }).catch(()=>{});
    fetch();
  }, [sheetId]);

  const displayed = useMemo(() => {
    let list = tab === "LOW" ? items.filter(i => i.isLowStock) : items;
    if (search) list = list.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || (i.category||"").toLowerCase().includes(search.toLowerCase()) || (i.supplier||"").toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [items, tab, search]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormErr(""); setShowModal(true); };
  const openEdit   = (i)  => { setEditing(i); setForm({ name:i.name, category:i.category||"", stock:i.stock, reorderLevel:i.reorderLevel||"", location:i.location||"", serialNo:i.serialNo||"", supplier:i.supplier||"", buyingRate:i.buyingRate||"", sellingRate:i.sellingRate||"", remarks:i.remarks||"" }); setFormErr(""); setShowModal(true); };
  const close      = ()  => { setShowModal(false); setEditing(null); };

  const save = async (e) => {
    e.preventDefault(); setFormErr(""); setSaving(true);
    try {
      if (editing) {
        const r = await api.patch(`/inventory/${sheetId}/${editing.id}`, form);
        setItems(prev => prev.map(i => i.id===editing.id ? r.data : i));
      } else {
        const r = await api.post(`/inventory/${sheetId}`, form);
        setItems(prev => [r.data, ...prev]);
      }
      close();
    } catch(e) { setFormErr(e.response?.data?.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const del = async (item) => {
    if (!confirm(`Delete "${item.name}" from inventory?`)) return;
    try { await api.delete(`/inventory/${sheetId}/${item.id}`); setItems(prev => prev.filter(i => i.id!==item.id)); }
    catch(e) { alert(e.response?.data?.message || "Delete failed"); }
  };

  const lowCount = items.filter(i => i.isLowStock).length;
  const f = (v) => { const { name, value } = v.target; setForm(p => ({...p, [name]: value})); };

  return (
    <AppLayout title="Inventory" subtitle="Spare parts, materials & stock management" actions={canDo.has("INPUT") && <button className="btn btn-primary" onClick={openCreate}>+ Add Item</button>}>
      {/* Stats */}
      <div className="grid-4" style={{marginBottom:20}}>
        {[["Total Items", items.length, "var(--text)"], ["Low Stock", lowCount, "var(--red)"], ["Categories", [...new Set(items.map(i=>i.category).filter(Boolean))].length, "var(--blue)"], ["No Reorder Level", items.filter(i=>!i.reorderLevel).length, "var(--muted)"]].map(([l,v,c])=>(
          <div key={l} className="stat-card"><div className="stat-label">{l}</div><div className="stat-value" style={{color:c}}>{v}</div></div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="card" style={{padding:"10px 14px",marginBottom:14}}>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div className="tabs">
            {["ALL","LOW"].map(t=><button key={t} className={`tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t==="LOW"?`⚠ Low Stock (${lowCount})`:"All Items"}</button>)}
          </div>
          <input className="input" style={{flex:1,minWidth:180}} placeholder="Search name, category, supplier..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <span style={{fontSize:"0.8rem",color:"var(--muted)"}}>{displayed.length} items</span>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{marginBottom:12}}>{error}</div>}
      {loading && <div style={{textAlign:"center",padding:40,color:"var(--muted)"}}>Loading...</div>}

      {!loading && displayed.length===0 && (
        <div className="card" style={{textAlign:"center",padding:48}}>
          <div style={{fontSize:"2.5rem",marginBottom:12}}>📦</div>
          <p style={{color:"var(--muted)"}}>{tab==="LOW" ? "No low-stock items." : "No inventory items yet."}</p>
          {canDo.has("INPUT")&&tab==="ALL"&&<button className="btn btn-primary" style={{marginTop:16}} onClick={openCreate}>Add First Item</button>}
        </div>
      )}

      {!loading && displayed.length>0 && (
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Name</th><th>Category</th><th>Stock</th><th>Reorder At</th>
                <th>Buying Rate</th><th>Selling Rate</th><th>Supplier</th><th>Status</th>
                {(canDo.has("EDIT")||canDo.has("DELETE"))&&<th style={{textAlign:"right"}}>Actions</th>}
              </tr></thead>
              <tbody>
                {displayed.map(item=>(
                  <tr key={item.id} style={item.isLowStock?{background:"#ef444408"}:{}}>
                    <td><span style={{fontWeight:600}}>{item.name}</span>{item.location&&<div style={{fontSize:"0.75rem",color:"var(--muted)"}}>{item.location}</div>}</td>
                    <td>{item.category||<span style={{color:"var(--muted)"}}>—</span>}</td>
                    <td><span className="mono" style={{fontWeight:700,color:item.isLowStock?"var(--red)":"var(--green)"}}>{parseFloat(item.stock).toFixed(2)}</span></td>
                    <td className="mono">{item.reorderLevel ? parseFloat(item.reorderLevel).toFixed(2) : <span style={{color:"var(--muted)"}}>—</span>}</td>
                    <td className="mono">{item.buyingRate  ? `Rs. ${parseFloat(item.buyingRate).toFixed(2)}`  : "—"}</td>
                    <td className="mono">{item.sellingRate ? `Rs. ${parseFloat(item.sellingRate).toFixed(2)}` : "—"}</td>
                    <td style={{color:"var(--muted)",fontSize:"0.82rem"}}>{item.supplier||"—"}</td>
                    <td>
                      {item.isLowStock
                        ? <span className="badge badge-red">⚠ Low Stock</span>
                        : <span className="badge badge-green">OK</span>}
                    </td>
                    {(canDo.has("EDIT")||canDo.has("DELETE"))&&(
                      <td style={{textAlign:"right"}}>
                        <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                          {canDo.has("EDIT")&&<button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>Edit</button>}
                          {canDo.has("DELETE")&&<button className="btn btn-danger btn-sm" onClick={()=>del(item)}>Delete</button>}
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

      {showModal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" style={{maxWidth:560}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 className="modal-title" style={{marginBottom:0}}>{editing?"Edit Item":"Add Inventory Item"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={close}>✕</button>
            </div>
            {formErr && <div className="alert alert-error" style={{marginBottom:14}}>{formErr}</div>}
            <form onSubmit={save}>
              <div className="grid-2" style={{gap:14}}>
                <div className="form-group" style={{gridColumn:"1/-1"}}><label className="label">Item Name *</label><input className="input" name="name" value={form.name} onChange={f} required placeholder="e.g. Bearing 6205"/></div>
                <div className="form-group"><label className="label">Category</label><input className="input" name="category" value={form.category} onChange={f} placeholder="e.g. Bearings"/></div>
                <div className="form-group"><label className="label">Location</label><input className="input" name="location" value={form.location} onChange={f} placeholder="e.g. Store Room A"/></div>
                <div className="form-group"><label className="label">Current Stock *</label><input className="input" name="stock" type="number" step="0.01" min="0" value={form.stock} onChange={f} required/></div>
                <div className="form-group"><label className="label">Reorder Level</label><input className="input" name="reorderLevel" type="number" step="0.01" min="0" value={form.reorderLevel} onChange={f} placeholder="Alert when stock ≤ this"/></div>
                <div className="form-group"><label className="label">Buying Rate (Rs.)</label><input className="input" name="buyingRate" type="number" step="0.01" min="0" value={form.buyingRate} onChange={f}/></div>
                <div className="form-group"><label className="label">Selling Rate (Rs.)</label><input className="input" name="sellingRate" type="number" step="0.01" min="0" value={form.sellingRate} onChange={f}/></div>
                <div className="form-group"><label className="label">Supplier</label><input className="input" name="supplier" value={form.supplier} onChange={f} placeholder="Supplier name"/></div>
                <div className="form-group"><label className="label">Serial No.</label><input className="input" name="serialNo" value={form.serialNo} onChange={f}/></div>
                <div className="form-group" style={{gridColumn:"1/-1"}}><label className="label">Remarks</label><textarea className="input" name="remarks" value={form.remarks} onChange={f} rows={2} style={{resize:"vertical"}}/></div>
              </div>
              <div style={{display:"flex",gap:10,marginTop:20}}>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{flex:1}}>{saving?"Saving...":editing?"Save Changes":"Add Item"}</button>
                <button type="button" className="btn btn-ghost" onClick={close} disabled={saving}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}