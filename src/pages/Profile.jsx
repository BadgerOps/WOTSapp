import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useUserProfile } from "../hooks/useUserProfile";
import { useSearchParams, Link } from "react-router-dom";
import {
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../config/firebase";
import Loading from "../components/common/Loading";
import DebugPanel from "../components/common/DebugPanel";
import { APP_VERSION } from "../config/appVersion";

export default function Profile() {
  const { user } = useAuth();
  const { profile, loading, error, updateProfile } = useUserProfile();
  const [personnelRecord, setPersonnelRecord] = useState(null);
  const [personnelLoading, setPersonnelLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [searchParams] = useSearchParams();
  const tapCount = useRef(0);
  const tapTimer = useRef(null);

  // Fetch user's personnel record
  useEffect(() => {
    async function fetchPersonnelRecord() {
      if (!user) {
        setPersonnelLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, "personnel"),
          where("userId", "==", user.uid),
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          const data = { id: doc.id, ...doc.data() };
          setPersonnelRecord(data);
          setPhoneNumber(data.phoneNumber || "");
          setRoomNumber(data.roomNumber || "");
        }
      } catch (err) {
        console.error("Error fetching personnel record:", err);
      } finally {
        setPersonnelLoading(false);
      }
    }

    fetchPersonnelRecord();
  }, [user]);

  // Fall back to profile data if no personnel record
  useEffect(() => {
    if (!personnelRecord && profile) {
      if (profile.phoneNumber && !phoneNumber) {
        setPhoneNumber(profile.phoneNumber);
      }
    }
  }, [profile, personnelRecord, phoneNumber]);

  // Check for ?debug=true in URL
  useEffect(() => {
    if (searchParams.get("debug") === "true") {
      setShowDebug(true);
    }
  }, [searchParams]);

  // Handle version tap to reveal debug panel (tap 5 times quickly)
  function handleVersionTap() {
    tapCount.current += 1;

    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
    }

    if (tapCount.current >= 5) {
      setShowDebug(true);
      tapCount.current = 0;
    } else {
      tapTimer.current = setTimeout(() => {
        tapCount.current = 0;
      }, 2000);
    }
  }

  if (loading || personnelLoading) {
    return <Loading />;
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      // Update personnel record if it exists
      if (personnelRecord) {
        await updateDoc(doc(db, "personnel", personnelRecord.id), {
          phoneNumber: phoneNumber.trim(),
          roomNumber: roomNumber.trim(),
          updatedAt: serverTimestamp(),
        });
      }

      // Also update user profile
      await updateProfile({
        phoneNumber: phoneNumber.trim(),
        roomNumber: roomNumber.trim(),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving profile:", err);
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-600">Manage your account settings</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Error loading profile: {error}
        </div>
      )}

      {/* Account Info (read-only from Google) */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Account Information
        </h2>
        <div className="flex items-center gap-4 mb-4">
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="w-16 h-16 rounded-full"
            />
          )}
          <div>
            <p className="font-medium text-gray-900">{user?.displayName}</p>
            <p className="text-sm text-gray-600">{user?.email}</p>
            {personnelRecord && (
              <p className="text-xs text-gray-500 mt-1">
                {personnelRecord.rank && `${personnelRecord.rank} `}
                {personnelRecord.firstName} {personnelRecord.lastName}
                {personnelRecord.flight &&
                  ` • ${personnelRecord.flight} Flight`}
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Account information is managed through your Google account.
        </p>
      </div>

      {/* Editable Settings */}
      <form onSubmit={handleSave} className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Contact Information
        </h2>

        {saveSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            Profile updated successfully!
          </div>
        )}

        {saveError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            Error saving: {saveError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter your phone number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              This will be auto-filled when signing out on pass.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Number
            </label>
            <input
              type="text"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="Enter your room number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Used for CQ signout roster and cleaning details.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {/* Version and Changelog */}
      <div className="mt-8 text-center space-y-2">
        <p
          onClick={handleVersionTap}
          className="text-xs text-gray-400 cursor-default select-none"
        >
          WOTSapp v{APP_VERSION} < NOTE: THIS IS NOT AN OFFICIAL WOTS Application\, this is a candidate led app>
        </p>
        <Link
          to="/changelog"
          className="inline-block text-sm text-primary-600 hover:text-primary-800 hover:underline"
        >
          View Changelog
        </Link>
      </div>

      {/* Debug Panel */}
      {showDebug && <DebugPanel onClose={() => setShowDebug(false)} />}
    </div>
  );
}
