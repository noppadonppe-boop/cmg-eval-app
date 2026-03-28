import React, { useState, useEffect } from 'react';
import { Shield, User, Search, CheckCircle2, Clock, X, Loader } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { ROLE_AVATAR_BG } from '../../hooks/useRBAC';
import Part2Discipline from '../eval/Part2Discipline';
import { subscribeAllUsers } from '../../services/authService';

export default function DisciplineTab() {
  const { userProfile, firebaseUser } = useAuth();
  const { selectedYear, activeQuarter, getEvaluationForPart } = useApp();
  
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [fbUsers, setFbUsers] = useState([]);
  const [fbLoading, setFbLoading] = useState(true);

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
  
  const filteredUsers = search.trim()
    ? fbUsers.filter(u => {
        const name = [u.firstName, u.lastName].join(' ').toLowerCase();
        return name.includes(search.toLowerCase()) || 
               String(u.staffCode || '').toLowerCase().includes(search.toLowerCase()) ||
               (u.email || '').toLowerCase().includes(search.toLowerCase());
      })
    : fbUsers;

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
                  const hrmApproved = record?.hrmApproved;
                  
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
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${hrmApproved ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                              <CheckCircle2 size={13} />
                              {hrmApproved ? 'อนุมัติแล้ว' : 'บันทึกแล้ว'}
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

      {/* Part 2 Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] px-4 py-8" onClick={() => setSelectedUser(null)}>
           <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
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
                 <div className="max-w-3xl mx-auto">
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
