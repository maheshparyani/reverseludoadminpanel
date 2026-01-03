'use client';

import { useEffect, useMemo, useState } from 'react';

const TASK_TYPES = [
  { value: 'kills', label: 'Kills' },
  { value: 'play_with_friends', label: 'Play With Friends' },
  { value: 'play_teamup', label: 'Play Teamup' },
  { value: 'play_online', label: 'Play Online' },
  { value: 'win_online', label: 'Win Online' },
  { value: 'win_teamup', label: 'Win Teamup' },
];

const REWARD_TYPES = [
  { value: 'coins', label: 'Coins' },
  { value: 'diamonds', label: 'Diamonds' },
  { value: 'talk_time', label: 'Talk Time (minutes)' },
  { value: 'inventory_item', label: 'Inventory Item' },
];

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function fromDatetimeLocalValue(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function emptyMission() {
  return {
    id: null,
    task_type: 'kills',
    target: 1,
    reward_type: 'coins',
    reward_amount: 100,
    reward_item_id: '',
    reward_duration_days: '',
  };
}

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [inventoryItems, setInventoryItems] = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [editing, setEditing] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    start_at: '',
    end_at: '',
    is_active: true,
    display_order: 0,
    missions: [emptyMission()],
  });

  useEffect(() => {
    loadEvents();
    loadInventory();
  }, []);

  const inventoryById = useMemo(() => {
    const m = new Map();
    for (const it of inventoryItems) {
      m.set(it.item_id, it);
    }
    return m;
  }, [inventoryItems]);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load events');
      setEvents(data.events || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadInventory() {
    setLoadingInventory(true);
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (data.items) setInventoryItems(data.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInventory(false);
    }
  }

  function resetForm() {
    setEditing(null);
    setBannerFile(null);
    setBannerPreview(null);
    setForm({
      title: '',
      description: '',
      start_at: '',
      end_at: '',
      is_active: true,
      display_order: 0,
      missions: [emptyMission()],
    });
    setShowModal(false);
  }

  function openCreate() {
    resetForm();
    setShowModal(true);
  }

  function openEdit(ev) {
    setEditing(ev);
    setBannerFile(null);
    setBannerPreview(ev.banner_url || null);
    setForm({
      title: ev.title || '',
      description: ev.description || '',
      start_at: toDatetimeLocalValue(ev.start_at),
      end_at: toDatetimeLocalValue(ev.end_at),
      is_active: !!ev.is_active,
      display_order: ev.display_order || 0,
      missions:
        (ev.missions || []).length > 0
          ? (ev.missions || []).map((m) => ({
              id: m.id,
              task_type: m.task_type,
              target: m.target,
              reward_type: m.reward_type,
              reward_amount: m.reward_amount,
              reward_item_id: m.reward_item_id || '',
              reward_duration_days: m.reward_duration_days || '',
            }))
          : [emptyMission()],
    });
    setShowModal(true);
  }

  function onBannerPicked(file) {
    if (!file) return;
    setBannerFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setBannerPreview(reader.result);
    reader.readAsDataURL(file);
  }

  function updateMission(idx, patch) {
    setForm((prev) => {
      const next = { ...prev };
      const missions = [...next.missions];
      missions[idx] = { ...missions[idx], ...patch };
      next.missions = missions;
      return next;
    });
  }

  function addMission() {
    setForm((prev) => ({ ...prev, missions: [...prev.missions, emptyMission()] }));
  }

  function removeMission(idx) {
    setForm((prev) => {
      const missions = [...prev.missions];
      missions.splice(idx, 1);
      return { ...prev, missions: missions.length ? missions : [emptyMission()] };
    });
  }

  async function saveEvent(e) {
    e.preventDefault();
    setSaving(true);

    try {
      const fd = new FormData();
      if (editing?.id) fd.set('id', editing.id);

      fd.set('title', form.title);
      fd.set('description', form.description);
      fd.set('start_at', fromDatetimeLocalValue(form.start_at));
      fd.set('end_at', fromDatetimeLocalValue(form.end_at));
      fd.set('is_active', String(!!form.is_active));
      fd.set('display_order', String(form.display_order || 0));

      fd.set('missions', JSON.stringify(form.missions));

      if (bannerFile) {
        fd.set('banner', bannerFile);
      }

      setUploading(!!bannerFile);

      const res = await fetch('/api/events', {
        method: editing ? 'PUT' : 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save event');

      resetForm();
      await loadEvents();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to save event');
    } finally {
      setUploading(false);
      setSaving(false);
    }
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;

    try {
      const res = await fetch('/api/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      await loadEvents();
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to delete');
    }
  }

  function getRewardLabel(m) {
    if (m.reward_type === 'inventory_item') {
      const item = inventoryById.get(m.reward_item_id);
      return item ? `${item.item_name} (${item.item_type})` : m.reward_item_id || 'Item';
    }

    if (m.reward_type === 'talk_time') return `${m.reward_amount || 0} minutes`;
    return `${m.reward_amount || 0}`;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Events</h1>
          <p className="text-gray-400 text-sm mt-1">Create live events with multiple missions and rewards.</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Event
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading events...</div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Banner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Dates</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Missions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Active</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {(events || []).map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      {ev.banner_url ? (
                        <img
                          src={ev.banner_url}
                          alt="banner"
                          className="w-24 h-12 object-cover rounded border border-gray-600"
                        />
                      ) : (
                        <div className="w-24 h-12 bg-gray-700 rounded border border-gray-600" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{ev.title}</div>
                      <div className="text-gray-400 text-sm line-clamp-1">{ev.description}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-sm">
                      <div>Start: {new Date(ev.start_at).toLocaleString()}</div>
                      <div>End: {new Date(ev.end_at).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-sm">
                      {(ev.missions || []).length}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          ev.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {ev.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(ev)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteEvent(ev.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">
                {editing ? 'Edit Event' : 'Create Event'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={saveEvent} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Display Order</label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value || '0', 10) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Start</label>
                  <input
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">End</label>
                  <input
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Banner</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onBannerPicked(e.target.files?.[0])}
                    className="w-full text-gray-300"
                  />
                  <div className="mt-2">
                    {bannerPreview ? (
                      <img
                        src={bannerPreview}
                        alt="preview"
                        className="w-full max-w-md h-28 object-cover rounded border border-gray-600"
                      />
                    ) : (
                      <div className="w-full max-w-md h-28 bg-gray-700 rounded border border-gray-600" />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Active</label>
                  <label className="flex items-center gap-2 text-gray-300">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    />
                    Enabled
                  </label>
                </div>
              </div>

              <div className="border border-gray-700 rounded-lg">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                  <div>
                    <h3 className="text-white font-semibold">Missions</h3>
                    <p className="text-gray-400 text-sm">Add one or more missions for this event.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addMission}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
                  >
                    Add Mission
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {form.missions.map((m, idx) => (
                    <div key={idx} className="bg-gray-900/30 border border-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-gray-200 font-medium">Mission #{idx + 1}</div>
                        <button
                          type="button"
                          onClick={() => removeMission(idx)}
                          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Task</label>
                          <select
                            value={m.task_type}
                            onChange={(e) => updateMission(idx, { task_type: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                          >
                            {TASK_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Target</label>
                          <input
                            type="number"
                            value={m.target}
                            min={1}
                            onChange={(e) => updateMission(idx, { target: parseInt(e.target.value || '1', 10) })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Reward Type</label>
                          <select
                            value={m.reward_type}
                            onChange={(e) => {
                              const nextType = e.target.value;
                              const patch = { reward_type: nextType };
                              if (nextType === 'inventory_item') {
                                patch.reward_item_id = m.reward_item_id || '';
                              }
                              updateMission(idx, patch);
                            }}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                          >
                            {REWARD_TYPES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {m.reward_type === 'inventory_item' ? (
                          <div className="md:col-span-2">
                            <label className="block text-xs text-gray-400 mb-1">Inventory Item</label>
                            <select
                              value={m.reward_item_id}
                              onChange={(e) => updateMission(idx, { reward_item_id: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                              disabled={loadingInventory}
                            >
                              <option value="">Select item</option>
                              {inventoryItems.map((it) => (
                                <option key={it.item_id} value={it.item_id}>
                                  {it.item_name} ({it.item_type})
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Reward Amount</label>
                            <input
                              type="number"
                              value={m.reward_amount || 0}
                              min={0}
                              onChange={(e) =>
                                updateMission(idx, { reward_amount: parseInt(e.target.value || '0', 10) })
                              }
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Preview</label>
                          <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm">
                            {getRewardLabel(m)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
                >
                  {saving ? 'Saving...' : uploading ? 'Uploading...' : editing ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
