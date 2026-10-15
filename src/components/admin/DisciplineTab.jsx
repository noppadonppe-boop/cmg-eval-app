import React, { useState, useEffect } from 'react';
import { Shield, User, Search, CheckCircle2, Clock, X, Loader, RefreshCw, AlertCircle, Settings2, Plus, Trash2, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import useRBAC, { ROLE_AVATAR_BG } from '../../hooks/useRBAC';
import Part2Discipline from '../eval/Part2Discipline';
import { subscribeAllUsers } from '../../services/authService';
import { fetchLeaveRecords } from '../../services/leaveService';
import { filterVisibleUsers } from '../../utils/userUtils';
import {
  calculateQuarterScore,
  DISCIPLINE_RULE_CATEGORIES,
  getCategoryMeta,
  getDisciplineRulesForYear,
  normalizeDisciplineRules,
} from '../../utils/disciplineRules';

export default function DisciplineTab() {
  const { userProfile, firebaseUser } = useAuth();
  const { data, selectedYear, activeQuarter, getEvaluationForPart, syncLeaveData, updateData } = useApp();
  const { can } = useRBAC();
  
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [fbUsers, setFbUsers] = useState([]);
  const [fbLoading, setFbLoading] = useState(true);
  const [leaveSyncing, setLeaveSyncing] = useState(false);
  const [leaveSyncResult, setLeaveSyncResult] = useState(null);
  const [leaveSyncError, setLeaveSyncError] = useState('');
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [draftRules, setDraftRules] = useState([]);

  useEffect(() => {
    const unsub = subscribeAllUsers((list) => {
      setFbUsers(list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setFbLoading(false);
    });
    return unsub;
  }, []);

  const displayName = userProfile
    ? [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ') || userProfile.email
    : firebaseUser?.displayName || firebaseUser?.email || 'Unknown User';
  
  const visibleUsers = filterVisibleUsers(fbUsers);
  const filteredUsers = search.trim()
    ? visibleUsers.filter(u => {
        const name = [u.firstName, u.lastName].join(' ').toLowerCase();
        return name.includes(search.toLowerCase()) || 
               String(u.staffCode || '').toLowerCase().includes(search.toLowerCase()) ||
               (u.email || '').toLowerCase().includes(search.toLowerCase());
      })
    : visibleUsers;

  const lastSyncMeta = data?.leaveSyncMeta?.[String(selectedYear)] || null;
  const canConfigureRules = can('canInputDiscipline');
  const activeRules = getDisciplineRulesForYear(data, selectedYear);

  const openRuleModal = () => {
    setDraftRules(activeRules.map((rule) => ({ ...rule })));
    setRuleModalOpen(true);
  };

  const addRule = () => {
    setDraftRules((previous) => [
      ...previous,
      {
        id: `discipline-rule-${Date.now()}-${previous.length}`,
        category: 'sick',
        threshold: 5,
        deduction: -1,
      },
    ]);
  };

  const updateRule = (id, updates) => {
    setDraftRules((previous) => previous.map((rule) => (
      rule.id === id ? { ...rule, ...updates } : rule
    )));
  };

  const removeRule = (id) => {
    setDraftRules((previous) => previous.filter((rule) => rule.id !== id));
  };

  const saveDisciplineRules = () => {
    const nextRules = normalizeDisciplineRules(draftRules);
    if (!selectedYear || !nextRules.length) return;
    const updatedAt = new Date().toISOString();

    updateData((previous) => {
      const nextEvaluations = (previous?.quarterlyEvaluations ?? []).map((evaluation) => {
        if (evaluation.year !== selectedYear || evaluation.part !== 'part2') return evaluation;
        const months = evaluation.months || {};
        const score = calculateQuarterScore(months, nextRules);
        return {
          ...evaluation,
          scaledScore: score,
          rawTotal: score,
          updatedAt,
        };
      });

      return {
        ...previous,
        disciplineRulesByYear: {
          ...(previous?.disciplineRulesByYear ?? {}),
          [String(selectedYear)]: nextRules,
        },
        quarterlyEvaluations: nextEvaluations,
      };
    });
    setRuleModalOpen(false);
  };

  const handleLeaveSync = async () => {
    if (!selectedYear || leaveSyncing) return;
    setLeaveSyncing(true);
    setLeaveSyncError('');
    setLeaveSyncResult(null);

    try {
      // The button is an explicit full refresh. Read the selected year's
      // collection again so employees with no changed leave documents are
      // also refreshed and receive a zero-leave/full-score baseline.
      const fetched = await fetchLeaveRecords(selectedYear, null);
      const summary = await syncLeaveData({
        year: selectedYear,
        sourceCollection: fetched.collectionName,
        sourceRecords: fetched.records,
        users: visibleUsers,
        fullSync: true,
        maxSourceUpdatedAt: fetched.maxSourceUpdatedAt,
        incrementalSafe: fetched.incrementalSafe,
      });
      setLeaveSyncResult({ ...summary, incremental: fetched.incremental });
    } catch (error) {
      console.error('Leave sync error:', error);
      setLeaveSyncError(error?.message || 'ไม่สามารถ Sync ข้อมูลการลาได้');
    } finally {
      setLeaveSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Banner */}
      <div className="px-5 py-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white text-indigo-600 rounded-full shadow-sm shrink-0">
            <User size={18} />
          </div>
          <div>
            <p className="text-xs text-indigo-500 font-medium">Logged in HR / HRM</p>
            <p className="text-sm font-bold text-indigo-800">{displayName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-indigo-500 font-medium">รอบการประเมินปัจจุบัน</p>
          <p className="text-sm font-bold text-indigo-800">ปี {selectedYear} · {activeQuarter}</p>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2 rounded-lg">
              <Shield size={20} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">กำหนดวินัยการทำงาน</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">คลิกที่พนักงานเพื่อบันทึกวันลาและแก้ไขใบเตือน</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ, อีเมล..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={handleLeaveSync}
              disabled={leaveSyncing || fbLoading || !selectedYear}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              title="อ่านข้อมูลลาแบบ Full Sync และอัปเดตพนักงานทุกคนที่แสดงในหน้านี้"
            >
              <RefreshCw size={14} className={leaveSyncing ? 'animate-spin' : ''} />
              {leaveSyncing ? 'กำลัง Sync...' : 'Sync Leave Data'}
            </button>
            {canConfigureRules && (
              <button
                type="button"
                onClick={openRuleModal}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 bg-white text-indigo-700 text-xs font-semibold hover:bg-indigo-50 transition-colors whitespace-nowrap"
                title="กำหนดเงื่อนไขการหักคะแนน"
              >
                <Settings2 size={14} />
                ตั้งค่าหักคะแนน
              </button>
            )}
          </div>
        </div>

        <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/70 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          <span className="text-gray-500">
            Last Sync:{' '}
            <strong className="text-gray-700">
              {lastSyncMeta?.lastSyncAt ? new Date(lastSyncMeta.lastSyncAt).toLocaleString('th-TH') : 'ยังไม่เคย Sync'}
            </strong>
          </span>
          {lastSyncMeta?.status === 'synced' && (
            <span className="text-green-700 inline-flex items-center gap-1 font-semibold">
              <CheckCircle2 size={13} /> Synced
            </span>
          )}
          {leaveSyncResult && (
            <span className="text-green-700 inline-flex items-center gap-1">
              <CheckCircle2 size={13} />
              อัปเดตพนักงาน {leaveSyncResult.syncedStaffCount ?? 0} คน · เพิ่ม {leaveSyncResult.added} · อัปเดต {leaveSyncResult.updated} · ไม่เปลี่ยนแปลง {leaveSyncResult.unchanged}
            </span>
          )}
          {leaveSyncError && (
            <span className="text-red-600 inline-flex items-center gap-1">
              <AlertCircle size={13} /> {leaveSyncError}
            </span>
          )}
        </div>
        
        {/* User List Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 border-t">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500">พนักงาน</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500">ตำแหน่ง</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500">รหัสพนักงาน</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">สถานะวินัย ({activeQuarter})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fbLoading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center">
                    <Loader size={22} className="animate-spin text-indigo-400 mx-auto" />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">
                    ไม่พบข้อมูลพนักงาน
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const record = getEvaluationForPart(selectedYear, activeQuarter, user.uid, 'part2');
                  const hasRecord = !!record && Object.keys(record.months || {}).length > 0;
                  const leaveSynced = record?.leaveSync?.status === 'synced';
                  
                  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Unknown';
                  const userRole = user.roles?.[0] || 'Staff';
                  
                  return (
                    <tr 
                      key={user.uid} 
                      onClick={() => setSelectedUser({ ...user, id: user.uid, name: userName, role: userRole })} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${ROLE_AVATAR_BG[userRole] || 'bg-gray-400'} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                            {userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{userName}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-md inline-block">{user.position || userRole}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-xs text-indigo-600 font-mono">{user.staffCode || '-'}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end">
                          {hasRecord ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${leaveSynced ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                              <CheckCircle2 size={13} />
                              {leaveSynced ? 'Synced' : 'บันทึกแล้ว'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 mb-0">
                              <Clock size={13} />
                              ยังไม่บันทึก
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Discipline deduction rules modal */}
      {ruleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] px-4 py-6" onClick={() => setRuleModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">เงื่อนไขการหักคะแนนวินัย</h2>
                <p className="text-xs text-gray-500 mt-1">ปี {selectedYear} · ถ้าค่ามากกว่าเงื่อนไข จะใช้กฎที่ตรงกับค่าสูงสุดของประเภทนั้น</p>
              </div>
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="p-2 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
                ตัวอย่าง: <strong>ลาพักร้อน · เกินโควต้า มากกว่า 3 วัน · -1 คะแนน</strong> และสามารถเพิ่มหลายรายการได้ โดยการหักคะแนนของแต่ละประเภทจะนำมารวมกัน
              </div>

              <div className="space-y-2">
                {draftRules.map((rule) => {
                  const meta = getCategoryMeta(rule.category);
                  const isVacation = meta.valueMode === 'overQuota';
                  return (
                    <div key={rule.id} className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_auto_auto_auto_auto] items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <select
                        value={rule.category}
                        onChange={(event) => updateRule(rule.id, { category: event.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        aria-label="ประเภทวินัย"
                      >
                        {DISCIPLINE_RULE_CATEGORIES.map((category) => (
                          <option key={category.key} value={category.key}>{category.label}</option>
                        ))}
                      </select>
                      <div className="text-xs text-gray-600 md:text-center">{isVacation ? 'เกินโควต้า มากกว่า' : 'จำนวนมากกว่า'}</div>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={rule.threshold}
                        onChange={(event) => updateRule(rule.id, { threshold: event.target.value })}
                        className="w-full md:w-24 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        aria-label="จำนวนวันหรือครั้ง"
                      />
                      <span className="text-xs text-gray-500">{meta.unit}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">=</span>
                        <input
                          type="number"
                          max="0"
                          step="0.5"
                          value={rule.deduction}
                          onChange={(event) => updateRule(rule.id, { deduction: event.target.value })}
                          className="w-24 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          aria-label="คะแนนที่หัก"
                        />
                        <span className="text-xs text-gray-500">คะแนน</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRule(rule.id)}
                        className="justify-self-end p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="ลบเงื่อนไข"
                        aria-label="ลบเงื่อนไข"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addRule}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-indigo-300 text-indigo-700 text-xs font-semibold hover:bg-indigo-50 transition-colors"
              >
                <Plus size={14} /> เพิ่มเงื่อนไข
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-white"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={saveDisciplineRules}
                disabled={!draftRules.length}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={14} /> บันทึกเงื่อนไข
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Part 2 Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] px-3 sm:px-5 py-6" onClick={() => setSelectedUser(null)}>
           <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-7xl flex flex-col h-[94vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 shrink-0">
                 <div>
                   <h2 className="text-lg font-bold text-gray-900">บันทึกวินัย: {selectedUser.name}</h2>
                   <p className="text-xs text-gray-500 mt-0.5">รอบการประเมิน {activeQuarter} / {selectedYear}</p>
                 </div>
                 <button 
                  onClick={() => setSelectedUser(null)} 
                  className="p-2 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors"
                 >
                    <X size={20} />
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                 {/* Rendering the existing Part 2 Module */}
                 <div className="w-full max-w-none">
                   <Part2Discipline 
                      staffId={selectedUser.id} 
                      quarter={activeQuarter} 
                      year={selectedYear} 
                      staffOverride={selectedUser}
                   />
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
