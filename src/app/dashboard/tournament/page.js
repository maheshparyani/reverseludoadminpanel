'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function TournamentPage() {
  const [tournaments, setTournaments] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({ 
    totalEntries: 0, 
    totalPlayers: 0, 
    avgScore: 0, 
    topScore: 0 
  });

  const [rewardClaims, setRewardClaims] = useState([]);
  const [showRewardClaimsModal, setShowRewardClaimsModal] = useState(false);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimProcessingId, setClaimProcessingId] = useState(null);
  const [claimNotes, setClaimNotes] = useState({});

  const [formData, setFormData] = useState({
    tournament_title: '',
    total_allowed_entries: 3,
    tournament_main_banner: '',
    tournament_start_time: '',
    tournament_end_time: '',
    tournament_result_time: ''
  });

  const bannerInputRef = useRef(null);

  useEffect(() => {
    fetchTournament();
  }, []);

  const loadTournamentDetails = async (tournamentData) => {
    if (!tournamentData) {
      setTournament(null);
      setLeaderboard([]);
      setStats({ totalEntries: 0, totalPlayers: 0, avgScore: 0, topScore: 0 });
      return;
    }

    setTournament(tournamentData);

    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('tournament_id', tournamentData.id)
      .order('rank');

    if (leaderboardError) throw leaderboardError;

    setLeaderboard(leaderboardData || []);
    calculateStats(tournamentData, leaderboardData || []);
  };

  const fetchTournament = async () => {
    setLoading(true);
    try {
      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournament')
        .select('*')
        .order('created_at', { ascending: false });

      if (tournamentsError) throw tournamentsError;

      const list = tournamentsData || [];
      setTournaments(list);

      const selectedTournament =
        (tournament && list.find(t => t.id === tournament.id)) ||
        list[0] ||
        null;

      await loadTournamentDetails(selectedTournament);
    } catch (err) {
      console.error('Error fetching tournament:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTournament = async (tournamentData) => {
    try {
      await loadTournamentDetails(tournamentData);
    } catch (err) {
      console.error('Error selecting tournament:', err);
    }
  };

  const calculateStats = (tournamentData, leaderboardData) => {
    const totalEntries = tournamentData.tournament_entries || 0;
    const totalPlayers = leaderboardData.length;
    const scores = leaderboardData.map(p => p.score || 0);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const topScore = scores.length > 0 ? Math.max(...scores) : 0;
    
    setStats({ totalEntries, totalPlayers, avgScore, topScore });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-500/20 text-gray-300';
      case 'Upcoming':
        return 'bg-blue-500/20 text-blue-400';
      case 'Active':
        return 'bg-green-500/20 text-green-400';
      case 'Ended':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'Results Out':
        return 'bg-purple-500/20 text-purple-400';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  const uploadBanner = async (file) => {
    if (!file) return null;
    
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `tournament_banner_${Date.now()}.${fileExt}`;
      const filePath = `tournament-banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('tournament-banners')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tournament-banners')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error('Error uploading banner:', err);
      alert('Error uploading banner: ' + err.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadBanner(file);
    if (url) setFormData(prev => ({ ...prev, tournament_main_banner: url }));
  };

  const handleCreate = async () => {
    try {
      if (!formData.tournament_start_time || !formData.tournament_end_time || !formData.tournament_result_time) {
        alert('Please fill in all required fields');
        return;
      }

      const titleValue = (formData.tournament_title || '').trim();
      const insertData = {
        tournament_title: titleValue.length > 0 ? titleValue : null,
        total_allowed_entries: formData.total_allowed_entries,
        tournament_main_banner: formData.tournament_main_banner || null,
        tournament_entries: 0,
        tournament_start_time: formData.tournament_start_time,
        tournament_end_time: formData.tournament_end_time,
        tournament_result_time: formData.tournament_result_time
      };
      
      const { data, error } = await supabase
        .from('tournament')
        .insert([insertData])
        .select();
      
      if (error) throw error;
      
      setShowCreateModal(false);
      resetForm();
      fetchTournament();
      alert('Tournament created successfully!');
    } catch (err) {
      console.error('Error creating tournament:', err);
      alert('Error creating tournament: ' + err.message);
    }
  };

  const handleUpdate = async () => {
    if (!tournament) return;
    try {
      const { error } = await supabase
        .from('tournament')
        .update(formData)
        .eq('id', tournament.id);
      
      if (error) throw error;
      
      setShowEditModal(false);
      resetForm();
      fetchTournament();
      alert('Tournament updated successfully!');
    } catch (err) {
      console.error('Error updating tournament:', err);
      alert('Error updating tournament: ' + err.message);
    }
  };

  const handleDelete = async (tournamentData = tournament) => {
    if (!tournamentData || !confirm('Are you sure you want to delete this tournament? This will also delete all leaderboard data.')) return;
    
    try {
      const { error } = await supabase
        .from('tournament')
        .delete()
        .eq('id', tournamentData.id);
      
      if (error) throw error;
      
      fetchTournament();
      alert('Tournament deleted successfully!');
    } catch (err) {
      console.error('Error deleting tournament:', err);
      alert('Error deleting tournament: ' + err.message);
    }
  };

  const openEditModal = (tournamentData = tournament) => {
    if (!tournamentData) return;
    
    setFormData({
      tournament_title: tournamentData.tournament_title || '',
      total_allowed_entries: tournamentData.total_allowed_entries || 3,
      tournament_main_banner: tournamentData.tournament_main_banner || '',
      tournament_start_time: tournamentData.tournament_start_time ? 
        tournamentData.tournament_start_time.replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, '').slice(0, 16) : '',
      tournament_end_time: tournamentData.tournament_end_time ? 
        tournamentData.tournament_end_time.replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, '').slice(0, 16) : '',
      tournament_result_time: tournamentData.tournament_result_time ? 
        tournamentData.tournament_result_time.replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, '').slice(0, 16) : ''
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      tournament_title: '',
      total_allowed_entries: 3,
      tournament_main_banner: '',
      tournament_start_time: '',
      tournament_end_time: '',
      tournament_result_time: ''
    });
  };

  const getTournamentStatus = (tournamentData = tournament) => {
    if (!tournamentData) return 'No Tournament';

    if (
      !tournamentData.tournament_start_time ||
      !tournamentData.tournament_end_time ||
      !tournamentData.tournament_result_time
    ) {
      return 'Draft';
    }

    const now = new Date();
    // Parse times as local by removing timezone info
    const startTime = new Date(tournamentData.tournament_start_time.replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, ''));
    const endTime = new Date(tournamentData.tournament_end_time.replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, ''));
    const resultTime = new Date(tournamentData.tournament_result_time.replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, ''));

    if (now < startTime) return 'Upcoming';
    if (now >= startTime && now < endTime) return 'Active';
    if (now >= endTime && now < resultTime) return 'Ended';
    return 'Results Out';
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    // Parse as local time by removing timezone info
    const cleanDateString = dateString.replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, '');
    return new Date(cleanDateString).toLocaleString();
  };

  const exportLeaderboardCSV = () => {
    if (leaderboard.length === 0) {
      alert('No leaderboard data to export');
      return;
    }

    const headers = ['Rank', 'Player Name', 'Player UID', 'Entries', 'Score'];
    const rows = leaderboard.map(p => [
      p.rank || '-',
      p.player_name || 'Unknown',
      p.player_uid || '-',
      p.entries || 0,
      p.score || 0
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tournament_leaderboard_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getClaimStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-500/20 text-green-400';
      case 'rejected': return 'bg-red-500/20 text-red-400';
      default: return 'bg-yellow-500/20 text-yellow-400';
    }
  };

  const fetchRewardClaims = async (tournamentId) => {
    if (!tournamentId) return;
    setClaimsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tournament_reward_claims')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRewardClaims(data || []);
    } catch (err) {
      console.error('Error fetching reward claims:', err);
      alert('Error fetching reward claims: ' + err.message);
    } finally {
      setClaimsLoading(false);
    }
  };

  const openRewardClaimsModal = async () => {
    if (!tournament) return;
    setShowRewardClaimsModal(true);
    await fetchRewardClaims(tournament.id);
  };

  const closeRewardClaimsModal = () => {
    setShowRewardClaimsModal(false);
    setRewardClaims([]);
    setClaimNotes({});
    setClaimProcessingId(null);
  };

  const updateClaimStatus = async (claimId, status) => {
    if (!tournament) return;
    if (!claimId) return;

    setClaimProcessingId(claimId);
    try {
      const hasNoteOverride = Object.prototype.hasOwnProperty.call(
        claimNotes ?? {},
        claimId,
      );
      const note = hasNoteOverride ? (claimNotes?.[claimId] ?? '').trim() : '';
      const nowIso = new Date().toISOString();

      const patch = {
        status,
        processed_at: nowIso,
        updated_at: nowIso,
      };

      if (hasNoteOverride) {
        patch.admin_note = note.length > 0 ? note : null;
      }

      const { error } = await supabase
        .from('tournament_reward_claims')
        .update(patch)
        .eq('id', claimId);

      if (error) throw error;
      await fetchRewardClaims(tournament.id);
    } catch (err) {
      console.error('Error updating claim status:', err);
      alert('Error updating claim status: ' + err.message);
    } finally {
      setClaimProcessingId(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Tournament Management</h1>
        <div className="flex space-x-3">
          {tournament && (
            <>
              <button 
                onClick={() => setShowLeaderboardModal(true)} 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View Leaderboard
              </button>
              <button 
                onClick={exportLeaderboardCSV} 
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </button>
              <button 
                onClick={openRewardClaimsModal} 
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Reward Claims
              </button>
            </>
          )}
          <button 
            onClick={() => { resetForm(); setShowCreateModal(true); }} 
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Tournament
          </button>
          {tournament && (
            <div className="flex space-x-2">
              <button 
                onClick={() => openEditModal()} 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Tournament
              </button>
              <button 
                onClick={() => handleDelete()} 
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Tournament
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Entries</p>
          <p className="text-2xl font-bold text-white">{stats.totalEntries.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Players</p>
          <p className="text-2xl font-bold text-blue-400">{stats.totalPlayers}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Average Score</p>
          <p className="text-2xl font-bold text-green-400">{stats.avgScore}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Top Score</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.topScore}</p>
        </div>
      </div>

      {/* Tournament List */}
      {!loading && tournaments.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 mb-6 overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">All Tournaments</h2>
            <button
              onClick={fetchTournament}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
            >
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Start</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">End</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {tournaments.map((t) => {
                  const status = getTournamentStatus(t);
                  const isSelected = tournament?.id === t.id;
                  const title = t.tournament_title || `Tournament #${t.id}`;

                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-gray-700/30 ${isSelected ? 'bg-gray-700/40' : ''}`}
                    >
                      <td className="px-4 py-4">
                        <p className="text-white font-medium">{title}</p>
                        <p className="text-gray-500 text-xs">ID: {t.id}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-300">{formatDateTime(t.tournament_start_time)}</td>
                      <td className="px-4 py-4 text-gray-300">{formatDateTime(t.tournament_end_time)}</td>
                      <td className="px-4 py-4 text-gray-300">{formatDateTime(t.created_at)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleSelectTournament(t)}
                            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                          >
                            View
                          </button>
                          <button
                            onClick={() => openEditModal(t)}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(t)}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tournament Card */}
      {loading ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
        </div>
      ) : tournament ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          {/* Tournament Header */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {tournament.tournament_title || 'Tournament'}
                  </h2>
                  <p className="text-gray-400">ID: {tournament.id}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(getTournamentStatus())}`}>
                  {getTournamentStatus()}
                </span>
                <p className="text-gray-400 text-sm mt-1">
                  Created: {formatDateTime(tournament.created_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Tournament Banner */}
          {tournament.tournament_main_banner && (
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-3">Tournament Banner</h3>
              <div className="w-full h-48 rounded-lg overflow-hidden">
                <img 
                  src={tournament.tournament_main_banner} 
                  alt="Tournament Banner" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Tournament Details */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Tournament Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm">Allowed Entries per Player</p>
                  <p className="text-white font-medium">{tournament.total_allowed_entries}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Games Played</p>
                  <p className="text-white font-medium">{tournament.tournament_entries}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Tournament Start Time</p>
                  <p className="text-white font-medium">{formatDateTime(tournament.tournament_start_time)}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm">Tournament End Time</p>
                  <p className="text-white font-medium">{formatDateTime(tournament.tournament_end_time)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Results Announcement</p>
                  <p className="text-white font-medium">{formatDateTime(tournament.tournament_result_time)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Last Updated</p>
                  <p className="text-white font-medium">{formatDateTime(tournament.updated_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Tournament Available</h2>
          <p className="text-gray-400 mb-6">Create a new tournament to get started.</p>
          <button 
            onClick={() => { resetForm(); setShowCreateModal(true); }} 
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
          >
            Create Your First Tournament
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700 m-4">
            <h3 className="text-xl font-semibold text-white mb-6">
              {showEditModal ? 'Edit Tournament' : 'Create New Tournament'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tournament Title
                </label>
                <input
                  type="text"
                  value={formData.tournament_title}
                  onChange={(e) => setFormData({ ...formData, tournament_title: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. Weekend Championship"
                />
              </div>

              {/* Allowed Entries */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Allowed Entries per Player *
                </label>
                <input 
                  type="number" 
                  min="1"
                  max="10"
                  value={formData.total_allowed_entries} 
                  onChange={(e) => setFormData({ ...formData, total_allowed_entries: parseInt(e.target.value) || 3 })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                  placeholder="3" 
                />
                <p className="text-gray-500 text-xs mt-1">How many times each player can participate</p>
              </div>

              {/* Tournament Banner Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tournament Banner
                </label>
                <div className="flex items-center space-x-3">
                  <input 
                    type="file" 
                    ref={bannerInputRef} 
                    onChange={handleBannerUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => bannerInputRef.current?.click()} 
                    disabled={uploading}
                    className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white hover:bg-gray-600 disabled:opacity-50 flex items-center"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Upload Banner
                      </>
                    )}
                  </button>
                  {formData.tournament_main_banner && (
                    <div className="flex items-center">
                      <img 
                        src={formData.tournament_main_banner} 
                        alt="Banner Preview" 
                        className="w-16 h-10 rounded-lg object-cover" 
                      />
                      <button 
                        onClick={() => setFormData({ ...formData, tournament_main_banner: '' })} 
                        className="ml-2 text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-1">This will be shown in the mobile app</p>
              </div>

              {/* Start Time */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tournament Start Time *
                </label>
                <input 
                  type="datetime-local" 
                  value={formData.tournament_start_time} 
                  onChange={(e) => setFormData({ ...formData, tournament_start_time: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                />
              </div>

              {/* End Time */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tournament End Time *
                </label>
                <input 
                  type="datetime-local" 
                  value={formData.tournament_end_time} 
                  onChange={(e) => setFormData({ ...formData, tournament_end_time: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                />
              </div>

              {/* Result Time */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Results Announcement Time *
                </label>
                <input 
                  type="datetime-local" 
                  value={formData.tournament_result_time} 
                  onChange={(e) => setFormData({ ...formData, tournament_result_time: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" 
                />
                <p className="text-gray-500 text-xs mt-1">When final results will be announced</p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button 
                onClick={() => { setShowCreateModal(false); setShowEditModal(false); resetForm(); }} 
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={showEditModal ? handleUpdate : handleCreate} 
                disabled={uploading} 
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
              >
                {showEditModal ? 'Update Tournament' : 'Create Tournament'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-4xl border border-gray-700 m-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white">Tournament Leaderboard</h3>
              <button 
                onClick={() => setShowLeaderboardModal(false)} 
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {leaderboard.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No players have participated yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Player</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Entries</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {leaderboard.map((player, index) => (
                      <tr key={player.id || index} className="hover:bg-gray-700/30">
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            {player.rank <= 3 ? (
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                player.rank === 1 ? 'bg-yellow-500' : 
                                player.rank === 2 ? 'bg-gray-400' : 'bg-orange-600'
                              }`}>
                                {player.rank}
                              </div>
                            ) : (
                              <span className="text-white font-medium">{player.rank || '-'}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                              {(player.player_name || 'U')[0].toUpperCase()}
                            </div>
                            <div className="ml-3">
                              <p className="text-white font-medium">{player.player_name || 'Unknown'}</p>
                              <p className="text-gray-500 text-xs">{player.player_uid?.slice(0, 12)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-blue-400 font-medium">{player.entries || 0}</td>
                        <td className="px-4 py-4 text-green-400 font-bold text-lg">{player.score || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center">
              <p className="text-gray-400 text-sm">
                Total Players: {leaderboard.length} | Total Entries: {stats.totalEntries}
              </p>
              <button 
                onClick={exportLeaderboardCSV}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {showRewardClaimsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-6xl border border-gray-700 m-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-white">Reward Claim Requests</h3>
                <p className="text-gray-400 text-sm">Tournament ID: {tournament?.id}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => fetchRewardClaims(tournament?.id)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                >
                  Refresh
                </button>
                <button 
                  onClick={closeRewardClaimsModal} 
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {claimsLoading ? (
              <div className="p-6 text-center text-gray-400">Loading...</div>
            ) : rewardClaims.length === 0 ? (
              <div className="p-6 text-center text-gray-400">No reward claim requests found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Player</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {rewardClaims.map((claim) => (
                      <tr key={claim.id} className="hover:bg-gray-700/30">
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                              claim.rank === 1 ? 'bg-yellow-500' :
                              claim.rank === 2 ? 'bg-gray-400' :
                              claim.rank === 3 ? 'bg-orange-600' :
                              'bg-gray-600'
                            }`}>
                              {claim.rank || '-'}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                              {(claim.player_name || 'U')[0].toUpperCase()}
                            </div>
                            <div className="ml-3">
                              <p className="text-white font-medium">{claim.player_name || 'Unknown'}</p>
                              <p className="text-gray-500 text-xs">{claim.player_uid?.slice(0, 12)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-white font-medium capitalize">{claim.contact_type}</p>
                          <p className="text-gray-300 text-sm break-all">{claim.contact_value}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getClaimStatusColor(claim.status)}`}>
                            {claim.status || 'pending'}
                          </span>
                          {claim.admin_note && (
                            <p className="text-gray-400 text-xs mt-1 break-words">{claim.admin_note}</p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-gray-300">{formatDateTime(claim.created_at)}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col space-y-2">
                            <input
                              value={claimNotes?.[claim.id] ?? claim.admin_note ?? ''}
                              onChange={(e) => setClaimNotes((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                              placeholder="Admin note (optional)"
                              className="w-64 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <div className="flex space-x-2">
                              <button
                                onClick={() => updateClaimStatus(claim.id, 'approved')}
                                disabled={claimProcessingId === claim.id}
                                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => updateClaimStatus(claim.id, 'rejected')}
                                disabled={claimProcessingId === claim.id}
                                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center">
              <p className="text-gray-400 text-sm">Total Requests: {rewardClaims.length}</p>
              <button
                onClick={closeRewardClaimsModal}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}