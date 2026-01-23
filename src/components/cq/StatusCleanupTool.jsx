import { useState, useEffect } from 'react'
import { collection, query, onSnapshot, doc, deleteDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { usePersonnel } from '../../hooks/usePersonnel'
import Loading from '../common/Loading'

/**
 * Admin tool to find and clean up orphaned/duplicate personnelStatus documents.
 *
 * The issue: Status documents can exist at both:
 * - Auth UID (from self-service sign-out)
 * - Personnel doc ID (from being added as a companion)
 *
 * This tool identifies mismatches and allows cleanup.
 */
export default function StatusCleanupTool() {
  const { personnel, loading: personnelLoading } = usePersonnel()
  const [statuses, setStatuses] = useState({})
  const [statusLoading, setStatusLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [cleanupResults, setCleanupResults] = useState(null)

  // Fetch all status documents
  useEffect(() => {
    const q = query(collection(db, 'personnelStatus'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const statusMap = {}
      snapshot.docs.forEach((doc) => {
        statusMap[doc.id] = {
          id: doc.id,
          ...doc.data(),
        }
      })
      setStatuses(statusMap)
      setStatusLoading(false)
    })
    return unsubscribe
  }, [])

  if (personnelLoading || statusLoading) {
    return <Loading />
  }

  // Build lookup maps
  const personnelByAuthUid = {} // userId -> personnel record
  const personnelByDocId = {}   // personnel doc id -> personnel record
  const personnelByEmail = {}   // email -> personnel record

  personnel.forEach((p) => {
    if (p.userId) personnelByAuthUid[p.userId] = p
    personnelByDocId[p.id] = p
    if (p.email) personnelByEmail[p.email.toLowerCase()] = p
  })

  // Categorize status documents
  const analysis = {
    // Status docs that match an Auth UID (correct for self-service)
    authUidMatches: [],
    // Status docs that match a personnel doc ID (legacy/companion)
    personnelDocIdMatches: [],
    // Status docs that match by email only
    emailMatches: [],
    // Status docs with no matching personnel record
    orphaned: [],
    // Personnel who have BOTH an Auth UID status AND a personnel doc ID status
    duplicates: [],
  }

  Object.entries(statuses).forEach(([statusId, statusData]) => {
    const matchedByAuthUid = personnelByAuthUid[statusId]
    const matchedByDocId = personnelByDocId[statusId]
    const matchedByEmail = statusData.userEmail
      ? personnelByEmail[statusData.userEmail.toLowerCase()]
      : null

    if (matchedByAuthUid) {
      analysis.authUidMatches.push({
        statusId,
        statusData,
        personnel: matchedByAuthUid,
        matchType: 'authUid',
      })
    } else if (matchedByDocId) {
      analysis.personnelDocIdMatches.push({
        statusId,
        statusData,
        personnel: matchedByDocId,
        matchType: 'personnelDocId',
      })
    } else if (matchedByEmail) {
      analysis.emailMatches.push({
        statusId,
        statusData,
        personnel: matchedByEmail,
        matchType: 'email',
      })
    } else {
      analysis.orphaned.push({
        statusId,
        statusData,
      })
    }
  })

  // Find duplicates: personnel with status at BOTH Auth UID and personnel doc ID
  personnel.forEach((p) => {
    if (p.userId && p.userId !== p.id) {
      const authUidStatus = statuses[p.userId]
      const docIdStatus = statuses[p.id]
      if (authUidStatus && docIdStatus) {
        analysis.duplicates.push({
          personnel: p,
          authUidStatus: { id: p.userId, ...authUidStatus },
          docIdStatus: { id: p.id, ...docIdStatus },
        })
      }
    }
  })

  // Find personnel doc ID statuses that SHOULD use Auth UID
  const staleStatuses = analysis.personnelDocIdMatches.filter((match) => {
    // If this personnel has a linked account (userId), the status should be at userId, not personnel doc ID
    return match.personnel.userId && match.personnel.userId !== match.statusId
  })

  async function handleCleanupStale() {
    if (!confirm(`This will delete ${staleStatuses.length} stale status document(s). The correct status at Auth UID will be preserved. Continue?`)) {
      return
    }

    setCleaning(true)
    setCleanupResults(null)

    try {
      const batch = writeBatch(db)
      const deleted = []

      for (const match of staleStatuses) {
        batch.delete(doc(db, 'personnelStatus', match.statusId))
        deleted.push({
          name: `${match.personnel.firstName} ${match.personnel.lastName}`,
          deletedId: match.statusId,
          correctId: match.personnel.userId,
        })
      }

      await batch.commit()
      setCleanupResults({
        success: true,
        message: `Deleted ${deleted.length} stale status document(s)`,
        deleted,
      })
    } catch (error) {
      console.error('Cleanup error:', error)
      setCleanupResults({
        success: false,
        message: error.message,
      })
    } finally {
      setCleaning(false)
    }
  }

  async function handleDeleteOrphaned() {
    if (!confirm(`This will delete ${analysis.orphaned.length} orphaned status document(s) that have no matching personnel record. Continue?`)) {
      return
    }

    setCleaning(true)
    setCleanupResults(null)

    try {
      const batch = writeBatch(db)

      for (const orphan of analysis.orphaned) {
        batch.delete(doc(db, 'personnelStatus', orphan.statusId))
      }

      await batch.commit()
      setCleanupResults({
        success: true,
        message: `Deleted ${analysis.orphaned.length} orphaned status document(s)`,
      })
    } catch (error) {
      console.error('Cleanup error:', error)
      setCleanupResults({
        success: false,
        message: error.message,
      })
    } finally {
      setCleaning(false)
    }
  }

  async function handleResolveDuplicate(dup, keepAuthUid) {
    const toDelete = keepAuthUid ? dup.docIdStatus.id : dup.authUidStatus.id
    const toKeep = keepAuthUid ? dup.authUidStatus.id : dup.docIdStatus.id

    if (!confirm(`Delete status at "${toDelete}" and keep status at "${toKeep}"?`)) {
      return
    }

    setCleaning(true)
    try {
      await deleteDoc(doc(db, 'personnelStatus', toDelete))
      setCleanupResults({
        success: true,
        message: `Deleted duplicate status for ${dup.personnel.firstName} ${dup.personnel.lastName}`,
      })
    } catch (error) {
      console.error('Delete error:', error)
      setCleanupResults({
        success: false,
        message: error.message,
      })
    } finally {
      setCleaning(false)
    }
  }

  function formatStatus(statusData) {
    if (!statusData) return 'N/A'
    const status = statusData.status || 'present'
    const stage = statusData.passStage ? ` (${statusData.passStage})` : ''
    return `${status}${stage}`
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Status Document Analysis</h2>
        <p className="text-sm text-gray-600 mb-4">
          This tool identifies personnelStatus documents that may be orphaned or duplicated due to ID mismatches.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-700">{analysis.authUidMatches.length}</div>
            <div className="text-xs text-green-600">Auth UID (correct)</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-yellow-700">{analysis.personnelDocIdMatches.length}</div>
            <div className="text-xs text-yellow-600">Personnel Doc ID</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-red-700">{analysis.orphaned.length}</div>
            <div className="text-xs text-red-600">Orphaned</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-purple-700">{analysis.duplicates.length}</div>
            <div className="text-xs text-purple-600">Duplicates</div>
          </div>
        </div>

        {cleanupResults && (
          <div className={`p-3 rounded-lg mb-4 ${cleanupResults.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {cleanupResults.message}
          </div>
        )}
      </div>

      {/* Stale Status Documents (personnel doc ID when Auth UID exists) */}
      {staleStatuses.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-yellow-700">Stale Status Documents</h3>
              <p className="text-sm text-gray-600">
                These statuses use personnel doc ID but the person has a linked account (Auth UID).
              </p>
            </div>
            <button
              onClick={handleCleanupStale}
              disabled={cleaning}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
            >
              {cleaning ? 'Cleaning...' : `Delete ${staleStatuses.length} Stale`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left py-2 px-2">Stale Doc ID</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Correct Auth UID</th>
                </tr>
              </thead>
              <tbody>
                {staleStatuses.map((match) => (
                  <tr key={match.statusId} className="border-b">
                    <td className="py-2 px-2">{match.personnel.firstName} {match.personnel.lastName}</td>
                    <td className="py-2 px-2 font-mono text-xs text-red-600">{match.statusId.slice(0, 12)}...</td>
                    <td className="py-2 px-2">{formatStatus(match.statusData)}</td>
                    <td className="py-2 px-2 font-mono text-xs text-green-600">{match.personnel.userId?.slice(0, 12)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Duplicates */}
      {analysis.duplicates.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-purple-700 mb-2">Duplicate Status Documents</h3>
          <p className="text-sm text-gray-600 mb-4">
            These personnel have status documents at BOTH their Auth UID and personnel doc ID.
          </p>
          <div className="space-y-4">
            {analysis.duplicates.map((dup) => (
              <div key={dup.personnel.id} className="border rounded-lg p-4">
                <div className="font-medium mb-2">
                  {dup.personnel.rank && `${dup.personnel.rank} `}
                  {dup.personnel.firstName} {dup.personnel.lastName}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-xs text-green-600 mb-1">Auth UID (self-service)</div>
                    <div className="font-mono text-xs mb-1">{dup.authUidStatus.id.slice(0, 16)}...</div>
                    <div className="font-medium">{formatStatus(dup.authUidStatus)}</div>
                    <button
                      onClick={() => handleResolveDuplicate(dup, true)}
                      disabled={cleaning}
                      className="mt-2 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Keep This
                    </button>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded">
                    <div className="text-xs text-yellow-600 mb-1">Personnel Doc ID (companion)</div>
                    <div className="font-mono text-xs mb-1">{dup.docIdStatus.id.slice(0, 16)}...</div>
                    <div className="font-medium">{formatStatus(dup.docIdStatus)}</div>
                    <button
                      onClick={() => handleResolveDuplicate(dup, false)}
                      disabled={cleaning}
                      className="mt-2 px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                    >
                      Keep This
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orphaned Documents */}
      {analysis.orphaned.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-red-700">Orphaned Status Documents</h3>
              <p className="text-sm text-gray-600">
                These status documents don't match any personnel record.
              </p>
            </div>
            <button
              onClick={handleDeleteOrphaned}
              disabled={cleaning}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {cleaning ? 'Deleting...' : `Delete ${analysis.orphaned.length} Orphaned`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Document ID</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Email (if any)</th>
                  <th className="text-left py-2 px-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {analysis.orphaned.map((orphan) => (
                  <tr key={orphan.statusId} className="border-b">
                    <td className="py-2 px-2 font-mono text-xs">{orphan.statusId.slice(0, 16)}...</td>
                    <td className="py-2 px-2">{formatStatus(orphan.statusData)}</td>
                    <td className="py-2 px-2">{orphan.statusData.userEmail || '-'}</td>
                    <td className="py-2 px-2 text-xs text-gray-500">
                      {orphan.statusData.updatedAt?.toDate?.().toLocaleDateString() || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Good */}
      {staleStatuses.length === 0 && analysis.duplicates.length === 0 && analysis.orphaned.length === 0 && (
        <div className="bg-green-50 rounded-lg p-6 text-center">
          <div className="text-green-600 text-lg font-medium">All status documents are properly linked!</div>
          <p className="text-green-500 text-sm mt-1">No cleanup needed.</p>
        </div>
      )}
    </div>
  )
}
