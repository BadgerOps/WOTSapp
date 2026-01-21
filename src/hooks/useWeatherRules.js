import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

export function useWeatherRules() {
  const [rulesData, setRulesData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'weatherRules'),
      (snapshot) => {
        if (snapshot.exists()) {
          setRulesData(snapshot.data())
        } else {
          setRulesData({ rules: [], defaultUniformId: null })
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching weather rules:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  const rules = rulesData?.rules || []
  const defaultUniformId = rulesData?.defaultUniformId || null

  return { rules, defaultUniformId, rulesData, loading, error }
}

export function useWeatherRulesActions() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { user } = useAuth()

  async function saveRules(rules, defaultUniformId) {
    setLoading(true)
    setError(null)

    try {
      await setDoc(doc(db, 'settings', 'weatherRules'), {
        rules,
        defaultUniformId,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid,
      })
      setLoading(false)
    } catch (err) {
      console.error('Error saving weather rules:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function addRule(rule) {
    setLoading(true)
    setError(null)

    try {
      const rulesRef = doc(db, 'settings', 'weatherRules')
      const snapshot = await getDoc(rulesRef)

      let existingRules = []
      let defaultUniformId = null

      if (snapshot.exists()) {
        const data = snapshot.data()
        existingRules = data.rules || []
        defaultUniformId = data.defaultUniformId
      }

      const newRule = {
        ...rule,
        id: crypto.randomUUID(),
        enabled: true,
      }

      await setDoc(rulesRef, {
        rules: [...existingRules, newRule],
        defaultUniformId,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid,
      })

      setLoading(false)
      return newRule.id
    } catch (err) {
      console.error('Error adding rule:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function updateRule(ruleId, updates) {
    setLoading(true)
    setError(null)

    try {
      const rulesRef = doc(db, 'settings', 'weatherRules')
      const snapshot = await getDoc(rulesRef)

      if (!snapshot.exists()) {
        throw new Error('Rules document not found')
      }

      const data = snapshot.data()
      const rules = data.rules || []
      const updatedRules = rules.map((r) =>
        r.id === ruleId ? { ...r, ...updates } : r
      )

      await setDoc(rulesRef, {
        ...data,
        rules: updatedRules,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid,
      })

      setLoading(false)
    } catch (err) {
      console.error('Error updating rule:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function deleteRule(ruleId) {
    setLoading(true)
    setError(null)

    try {
      const rulesRef = doc(db, 'settings', 'weatherRules')
      const snapshot = await getDoc(rulesRef)

      if (!snapshot.exists()) {
        throw new Error('Rules document not found')
      }

      const data = snapshot.data()
      const rules = data.rules || []
      const filteredRules = rules.filter((r) => r.id !== ruleId)

      await setDoc(rulesRef, {
        ...data,
        rules: filteredRules,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid,
      })

      setLoading(false)
    } catch (err) {
      console.error('Error deleting rule:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function setDefaultUniform(uniformId) {
    setLoading(true)
    setError(null)

    try {
      const rulesRef = doc(db, 'settings', 'weatherRules')
      const snapshot = await getDoc(rulesRef)

      const existingData = snapshot.exists() ? snapshot.data() : { rules: [] }

      await setDoc(rulesRef, {
        ...existingData,
        defaultUniformId: uniformId,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid,
      })

      setLoading(false)
    } catch (err) {
      console.error('Error setting default uniform:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return { saveRules, addRule, updateRule, deleteRule, setDefaultUniform, loading, error }
}
