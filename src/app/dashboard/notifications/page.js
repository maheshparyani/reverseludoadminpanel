'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function NotificationsPage() {
  const [tournaments, setTournaments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [notificationType, setNotificationType] = useState('tournament');
  const [formData, setFormData] = useState({ title: '', message: '', type: 'general', tournament_id: '' });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');

  const [tournamentPlayers, setTournamentPlayers] = useState([]);
  const [tournamentPlayersLoading, setTournamentPlayersLoading] = useState(false);
  const [tournamentPlayerSearch, setTournamentPlayerSearch] = useState('');
  const [selectedTournamentUsers, setSelectedTournamentUsers] = useState([]);
  const [sentNotifications, setSentNotifications] = useState([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [tournamentsRes, usersRes] = await Promise.all([
        fetch('/api/tournaments'),
        fetch('/api/users'),
      ]);

      const tournamentsJson = await tournamentsRes.json();
      if (!tournamentsRes.ok) {
        throw new Error(tournamentsJson?.error || 'Failed to load tournaments');
      }

      const usersJson = await usersRes.json();
      if (!usersRes.ok) {
        throw new Error(usersJson?.error || 'Failed to load users');
      }

      setTournaments(tournamentsJson?.tournaments || []);
      setUsers(usersJson?.users || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const loadTournamentPlayers = async (tournamentId) => {
    if (!tournamentId) {
      setTournamentPlayers([]);
      setSelectedTournamentUsers([]);
      return;
    }

    setTournamentPlayersLoading(true);
    try {
      const res = await fetch(
        `/api/tournaments?players=1&tournamentId=${encodeURIComponent(tournamentId)}`,
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load tournament players');
      }

      const players = json?.players || [];
      setTournamentPlayers(players);
      setSelectedTournamentUsers(players.map((p) => p.player_uid));
    } catch (err) {
      console.error('Error loading tournament players:', err);
      setTournamentPlayers([]);
      setSelectedTournamentUsers([]);
    } finally {
      setTournamentPlayersLoading(false);
    }
  };

  const sendNotification = async () => {
    if (!formData.title || !formData.message) {
      alert('Title and message are required');
      return;
    }
    setLoading(true);
    try {
      let targetUsers = [];
      if (notificationType === 'tournament' && formData.tournament_id) {
        targetUsers = selectedTournamentUsers.filter(Boolean);
      } else if (notificationType === 'selected') {
        targetUsers = selectedUsers;
      } else if (notificationType === 'all') {
        // Legacy fallback: UI no longer allows this.
        alert('All Users notifications are disabled. Please choose Tournament Players or Select Users.');
        setLoading(false);
        return;
      }

      if (targetUsers.length === 0) {
        alert('No users to send notification to');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          message: formData.message,
          type: formData.type,
          target_users: targetUsers,
          tournament_id: formData.tournament_id || null,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result?.error || 'Error sending notification');
      }

      // Store notification record
      const notification = {
        title: formData.title,
        message: formData.message,
        type: formData.type,
        target_count: result?.sent_to ?? targetUsers.length,
        sent_at: new Date().toISOString()
      };
      setSentNotifications([notification, ...sentNotifications]);
      
      alert(`Notification sent to ${notification.target_count} users!`);
      setShowModal(false);
      setFormData({ title: '', message: '', type: 'general', tournament_id: '' });
      setSelectedUsers([]);
      setUserSearch('');
      setTournamentPlayers([]);
      setSelectedTournamentUsers([]);
      setTournamentPlayerSearch('');
    } catch (err) {
      console.error('Error sending notification:', err);
      alert(err?.message || 'Error sending notification');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = (userSearch || '').trim().toLowerCase();
    if (!q) return true;
    const uid = (u.uid || u.id || '').toString().toLowerCase();
    const username = (u.username || '').toString().toLowerCase();
    const email = (u.email || '').toString().toLowerCase();
    return uid.includes(q) || username.includes(q) || email.includes(q);
  });

  const filteredTournamentPlayers = tournamentPlayers.filter((p) => {
    const q = (tournamentPlayerSearch || '').trim().toLowerCase();
    if (!q) return true;
    const uid = (p.player_uid || '').toString().toLowerCase();
    const name = (p.player_name || '').toString().toLowerCase();
    return uid.includes(q) || name.includes(q);
  });

  const notificationTemplates = [
    { title: 'New Tournament!', message: 'A new tournament is starting soon. Join now to win amazing prizes!', type: 'tournament' },
    { title: 'Tournament Starting', message: 'Your tournament is about to begin. Get ready to play!', type: 'tournament' },
    { title: 'Tournament Winner', message: 'Congratulations! You won the tournament!', type: 'tournament' },
    { title: 'New Update Available', message: 'A new version of the app is available. Update now for the best experience!', type: 'update' },
    { title: 'Daily Bonus', message: 'Claim your daily bonus now! Login to receive free coins.', type: 'reward' },
    { title: 'Special Offer', message: 'Limited time offer! Get bonus coins on your next purchase.', type: 'promo' },
  ];

  const applyTemplate = (template) => {
    setFormData({ ...formData, title: template.title, message: template.message, type: template.type });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          Send Notification
        </button>
      </div>

      <div className="mb-4 p-3 bg-blue-900/30 border border-blue-600/50 rounded-lg text-sm text-gray-200">
        <Link href="/dashboard/push" className="text-blue-300 font-semibold underline hover:text-white">
          Push Notification
        </Link>
        {' '}
        — phone par push (Firebase). Is page se message{' '}
        <strong className="text-white">in-app mailbox</strong> / DB mein jata hai (<code className="text-purple-300">/api/notifications</code>
        ).
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Users</p>
          <p className="text-2xl font-bold text-white">{users.length}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Active Tournaments</p>
          <p className="text-2xl font-bold text-purple-400">{tournaments.length}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Notifications Sent</p>
          <p className="text-2xl font-bold text-green-400">{sentNotifications.length}</p>
        </div>
      </div>

      {/* Templates */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Templates</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {notificationTemplates.map((t, idx) => (
            <button key={idx} onClick={() => { applyTemplate(t); setShowModal(true); }}
              className="p-4 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-left transition-colors">
              <p className="text-white font-medium text-sm">{t.title}</p>
              <p className="text-gray-400 text-xs mt-1 line-clamp-2">{t.message}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Notifications */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Recent Notifications</h2>
        </div>
        {sentNotifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No notifications sent yet</div>
        ) : (
          <div className="divide-y divide-gray-700">
            {sentNotifications.map((n, idx) => (
              <div key={idx} className="p-4 hover:bg-gray-700/30">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white font-medium">{n.title}</p>
                    <p className="text-gray-400 text-sm mt-1">{n.message}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">{n.target_count} users</span>
                    <p className="text-gray-500 text-xs mt-1">{new Date(n.sent_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700 m-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-white mb-6">Send Notification</h3>
            
            {/* Target Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Send To</label>
              <div className="flex space-x-2">
                {['tournament', 'selected'].map(type => (
                  <button key={type} onClick={() => setNotificationType(type)}
                    className={`px-4 py-2 rounded-lg text-sm ${notificationType === type ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                    {type === 'tournament' ? 'Tournament Players' : 'Select Users'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tournament Selection */}
            {notificationType === 'tournament' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Tournament</label>
                <select value={formData.tournament_id} onChange={(e) => {
                  const nextId = e.target.value;
                  setFormData({ ...formData, tournament_id: nextId });
                  loadTournamentPlayers(nextId);
                }}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                  <option value="">Select a tournament</option>
                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.tournament_title || `Tournament #${t.id}`}</option>)}
                </select>

                {formData.tournament_id && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tournament Players (from leaderboard)
                    </label>
                    <input
                      type="text"
                      value={tournamentPlayerSearch}
                      onChange={(e) => setTournamentPlayerSearch(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white mb-2"
                      placeholder="Search by player UID or name"
                    />

                    {tournamentPlayersLoading ? (
                      <div className="text-gray-400 text-sm">Loading players...</div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-gray-400 text-xs">
                            {selectedTournamentUsers.length} selected
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedTournamentUsers(tournamentPlayers.map((p) => p.player_uid))}
                            className="text-xs text-purple-400 hover:text-purple-300"
                          >
                            Select all
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto bg-gray-700/50 rounded-lg p-2">
                          {filteredTournamentPlayers.map((p) => (
                            <label key={p.player_uid} className="flex items-center p-2 hover:bg-gray-700 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedTournamentUsers.includes(p.player_uid)}
                                onChange={(e) => setSelectedTournamentUsers(
                                  e.target.checked
                                    ? [...selectedTournamentUsers, p.player_uid]
                                    : selectedTournamentUsers.filter((id) => id !== p.player_uid)
                                )}
                                className="mr-3"
                              />
                              <span className="text-white">
                                {p.player_name || p.player_uid}
                              </span>
                              <span className="text-gray-500 text-xs ml-2">
                                {p.player_uid?.slice(0, 10)}
                              </span>
                            </label>
                          ))}
                          {filteredTournamentPlayers.length === 0 && (
                            <div className="p-2 text-gray-500 text-sm">No players found</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* User Selection */}
            {notificationType === 'selected' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Users ({selectedUsers.length} selected)</label>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white mb-2"
                  placeholder="Search by UID, username, or email"
                />
                <div className="max-h-40 overflow-y-auto bg-gray-700/50 rounded-lg p-2">
                  {filteredUsers.map(u => {
                    const uid = u.uid || u.id;
                    return (
                      <label key={uid} className="flex items-center p-2 hover:bg-gray-700 rounded cursor-pointer">
                        <input type="checkbox" checked={selectedUsers.includes(uid)}
                          onChange={(e) => setSelectedUsers(e.target.checked ? [...selectedUsers, uid] : selectedUsers.filter(id => id !== uid))}
                          className="mr-3" />
                        <span className="text-white">{u.username || u.email || uid?.slice(0, 8)}</span>
                        <span className="text-gray-500 text-xs ml-2">{uid?.slice(0, 10)}</span>
                      </label>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <div className="p-2 text-gray-500 text-sm">No users found</div>
                  )}
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white" placeholder="Notification title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Message *</label>
                <textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white" rows={3} placeholder="Notification message" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                  <option value="general">General</option>
                  <option value="tournament">Tournament</option>
                  <option value="update">Update</option>
                  <option value="reward">Reward</option>
                  <option value="promo">Promotion</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Cancel</button>
              <button onClick={sendNotification} disabled={loading} className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50">
                {loading ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
