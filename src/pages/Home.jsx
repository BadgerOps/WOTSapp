import { useAuth } from '../contexts/AuthContext'
import { useAppConfig } from '../hooks/useAppConfig'
import PostFeed from '../components/posts/PostFeed'
import MyPassStatusCard from '../components/cq/MyPassStatusCard'
import MyDetailCard from '../components/details/MyDetailCard'
import MyCQShiftCard from '../components/cq/MyCQShiftCard'
import PendingSurveyCard from '../components/surveys/PendingSurveyCard'

/**
 * Calculate the graduation countdown ("X days and a wakeup")
 * @param {string} graduationDate - YYYY-MM-DD format
 * @returns {number|null} - Days left (graduation day - 1), or null if no date set
 */
function getGraduationCountdown(graduationDate) {
  if (!graduationDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const gradDate = new Date(graduationDate + 'T00:00:00')
  const diffTime = gradDate - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  // "X days and a wakeup" means graduation day minus 1
  return diffDays - 1
}

export default function Home() {
  const { user } = useAuth()
  const { config } = useAppConfig()

  const daysLeft = getGraduationCountdown(config?.graduationDate)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, Candidate {user?.displayName?.split(' ')[1]}
        </h1>
        {daysLeft !== null && daysLeft > 0 && (
          <p className="text-lg font-semibold text-primary-600 mt-1">
            {daysLeft} days and a wakeup left!
          </p>
        )}
        {daysLeft === 0 && (
          <p className="text-lg font-semibold text-primary-600 mt-1">
            Tomorrow is the day!
          </p>
        )}
        <p className="text-gray-600">Stay updated with the latest announcements</p>
      </div>

      {/* Pass Status Card - shows if user is on pass */}
      <MyPassStatusCard />

      {/* Detail Card - shows at 7am and 7:30pm if user has assigned details */}
      <MyDetailCard />

      {/* CQ Shift Card - shows if user has CQ duty today */}
      <MyCQShiftCard />

      {/* Pending Survey Card - shows if user has unanswered surveys */}
      <PendingSurveyCard />

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Today's Updates</h2>
      <PostFeed todayOnly={true} />
    </div>
  )
}
