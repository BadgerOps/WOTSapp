const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

// When a new personnel record is created, create a Firebase Auth account if it doesn't exist
exports.onPersonnelCreated = onDocumentCreated(
  {
    document: 'personnel/{personnelId}',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (event) => {
    const personnelData = event.data.data()
    const personnelId = event.params.personnelId

    // Skip if userId already exists (account already linked)
    if (personnelData.userId) {
      console.log(`Personnel ${personnelId} already has userId, skipping auth creation`)
      return
    }

    // Skip if no email
    if (!personnelData.email) {
      console.log(`Personnel ${personnelId} has no email, skipping auth creation`)
      return
    }

    try {
      const auth = getAuth()
      const db = getFirestore()

      // Check if user already exists in Firebase Auth by email
      let userRecord
      try {
        userRecord = await auth.getUserByEmail(personnelData.email)
        console.log(`User already exists in Firebase Auth: ${userRecord.uid}`)
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // User doesn't exist, create new auth account
          console.log(`Creating new Firebase Auth account for: ${personnelData.email}`)

          // Generate random password (12 characters)
          const randomPassword = generateRandomPassword(12)

          userRecord = await auth.createUser({
            email: personnelData.email,
            password: randomPassword,
            displayName: `${personnelData.firstName} ${personnelData.lastName}`.trim(),
            emailVerified: false,
          })

          console.log(`Created Firebase Auth account: ${userRecord.uid}`)

          // Store the generated password temporarily in a passwordResets collection
          // (admins can retrieve this to share with the user)
          await db.collection('passwordResets').doc(userRecord.uid).set({
            email: personnelData.email,
            temporaryPassword: randomPassword,
            personnelId: personnelId,
            createdAt: FieldValue.serverTimestamp(),
            used: false,
          })

          console.log(`Stored temporary password for ${personnelData.email}`)
        } else {
          throw error
        }
      }

      // Link the Firebase Auth UID to the personnel record
      await db.collection('personnel').doc(personnelId).update({
        userId: userRecord.uid,
        authCreatedAt: FieldValue.serverTimestamp(),
      })

      console.log(`Linked personnel ${personnelId} to auth user ${userRecord.uid}`)

      // Create user document in users collection if it doesn't exist
      const userDocRef = db.collection('users').doc(userRecord.uid)
      const userDoc = await userDocRef.get()

      if (!userDoc.exists) {
        await userDocRef.set({
          email: personnelData.email,
          displayName: `${personnelData.firstName} ${personnelData.lastName}`.trim(),
          photoURL: userRecord.photoURL || '',
          role: personnelData.role || 'user',
          createdAt: FieldValue.serverTimestamp(),
          lastLogin: null,
        })

        console.log(`Created user document for ${userRecord.uid}`)
      }

      return {
        success: true,
        userId: userRecord.uid,
        passwordStored: true,
      }
    } catch (error) {
      console.error(`Error creating auth for personnel ${personnelId}:`, error)
      // Don't throw - we don't want to fail the personnel creation
      return {
        success: false,
        error: error.message,
      }
    }
  }
)

function generateRandomPassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''

  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]
  password += '0123456789'[Math.floor(Math.random() * 10)]
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]

  // Fill the rest
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)]
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}
