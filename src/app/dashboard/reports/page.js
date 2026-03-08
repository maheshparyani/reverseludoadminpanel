'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export default function ReportsPage() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const [selectedReport, setSelectedReport] = useState(null);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('reports')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setReports(data || []);
        } catch (err) {
            console.error('Error fetching reports:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const deleteReport = async (id) => {
        if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) return;
        setDeletingId(id);
        try {
            const { error } = await supabase.from('reports').delete().eq('id', id);
            if (error) throw error;
            setReports((prev) => prev.filter((r) => r.id !== id));
            if (selectedReport?.id === id) setSelectedReport(null);
        } catch (err) {
            console.error('Error deleting report:', err);
            alert('Failed to delete report. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const filteredReports = reports.filter((r) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            r.reporter_username?.toLowerCase().includes(term) ||
            r.reported_username?.toLowerCase().includes(term) ||
            r.chat_id?.toLowerCase().includes(term) ||
            r.reporter_id?.toLowerCase().includes(term) ||
            r.reported_user_id?.toLowerCase().includes(term) ||
            r.last_message?.toLowerCase().includes(term)
        );
    });

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
        });
    };

    const shortId = (id) => (id ? `${id.slice(0, 8)}…` : '—');

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">User Reports</h1>
                    <p className="text-gray-400 text-sm mt-1">
                        {reports.length} total report{reports.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={fetchReports}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-gray-400 text-sm">Total Reports</p>
                    <p className="text-3xl font-bold text-white mt-1">{reports.length}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-gray-400 text-sm">Unique Reporters</p>
                    <p className="text-3xl font-bold text-yellow-400 mt-1">
                        {new Set(reports.map((r) => r.reporter_id)).size}
                    </p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-gray-400 text-sm">Unique Reported Users</p>
                    <p className="text-3xl font-bold text-red-400 mt-1">
                        {new Set(reports.map((r) => r.reported_user_id)).size}
                    </p>
                </div>
            </div>

            <div className="flex gap-6">
                {/* Table */}
                <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    {/* Search */}
                    <div className="p-4 border-b border-gray-700 flex items-center gap-3">
                        <div className="relative flex-1">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search by username, chat ID, or message…"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                            />
                        </div>
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-white text-sm">
                                Clear
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500 mx-auto" />
                            <p className="text-gray-400 mt-3 text-sm">Loading reports…</p>
                        </div>
                    ) : filteredReports.length === 0 ? (
                        <div className="p-12 text-center">
                            <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-gray-500">{searchTerm ? 'No reports match your search.' : 'No reports found.'}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-700/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Reporter</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Reported User</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Chat ID</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Last Message</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {filteredReports.map((report) => (
                                        <tr
                                            key={report.id}
                                            onClick={() => setSelectedReport(report)}
                                            className={`hover:bg-gray-700/40 cursor-pointer transition-colors ${selectedReport?.id === report.id ? 'bg-red-900/20 border-l-2 border-red-500' : ''}`}
                                        >
                                            <td className="px-4 py-4">
                                                <div className="font-medium text-white">{report.reporter_username}</div>
                                                <div className="text-gray-500 text-xs font-mono mt-0.5">{shortId(report.reporter_id)}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="font-medium text-red-400">{report.reported_username}</div>
                                                <div className="text-gray-500 text-xs font-mono mt-0.5">{shortId(report.reported_user_id)}</div>
                                            </td>
                                            <td className="px-4 py-4 text-gray-400 font-mono text-xs">{shortId(report.chat_id)}</td>
                                            <td className="px-4 py-4">
                                                <span className="text-gray-300 text-xs line-clamp-2 max-w-[180px] inline-block">
                                                    {report.last_message || <span className="text-gray-600 italic">No message</span>}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-gray-400 text-xs whitespace-nowrap">{formatDate(report.created_at)}</td>
                                            <td className="px-4 py-4">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteReport(report.id); }}
                                                    disabled={deletingId === report.id}
                                                    className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Delete Report"
                                                >
                                                    {deletingId === report.id ? (
                                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Detail Panel */}
                {selectedReport && (
                    <div className="w-80 bg-gray-800 rounded-xl border border-gray-700 p-5 self-start sticky top-0">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-white font-semibold text-base">Report Details</h2>
                            <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-white">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Reporter */}
                        <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
                            <p className="text-xs font-medium text-gray-400 uppercase mb-2">Reporter</p>
                            <p className="text-white font-semibold">{selectedReport.reporter_username}</p>
                            <p className="text-gray-400 text-xs font-mono mt-1 break-all">{selectedReport.reporter_id}</p>
                        </div>

                        {/* Reported User */}
                        <div className="mb-4 p-3 bg-red-900/30 border border-red-800/40 rounded-lg">
                            <p className="text-xs font-medium text-red-400 uppercase mb-2">Reported User</p>
                            <p className="text-red-300 font-semibold">{selectedReport.reported_username}</p>
                            <p className="text-red-400/60 text-xs font-mono mt-1 break-all">{selectedReport.reported_user_id}</p>
                        </div>

                        {/* Chat ID */}
                        <div className="mb-4">
                            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Chat ID</p>
                            <p className="text-gray-300 font-mono text-xs break-all">{selectedReport.chat_id}</p>
                        </div>

                        {/* Last Message */}
                        <div className="mb-4">
                            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Last Message at Report Time</p>
                            <div className="bg-gray-700/50 rounded-lg p-3">
                                <p className="text-gray-200 text-sm leading-relaxed">
                                    {selectedReport.last_message || <span className="text-gray-500 italic">No message captured</span>}
                                </p>
                            </div>
                        </div>

                        {/* Report ID */}
                        <div className="mb-4">
                            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Report ID</p>
                            <p className="text-gray-500 font-mono text-xs break-all">{selectedReport.id}</p>
                        </div>

                        {/* Date */}
                        <div className="mb-5">
                            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Reported At</p>
                            <p className="text-gray-300 text-sm">{formatDate(selectedReport.created_at)}</p>
                        </div>

                        {/* Delete Button */}
                        <button
                            onClick={() => deleteReport(selectedReport.id)}
                            disabled={deletingId === selectedReport.id}
                            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete This Report
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
