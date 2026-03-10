/**
 * useAuth — hook for MSAL state in NEXUS
 * Returns user info, login/logout, and the msal instance.
 * Works gracefully when MSAL_ENABLED=false (no client ID configured yet).
 */
import { useState, useEffect } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { loginRequest, MSAL_ENABLED } from './msalConfig'
import { getMyProfile, getMyPhoto } from './graphClient'

export function useAuth() {
  const { instance, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [profile, setProfile] = useState(null)
  const [photo, setPhoto]     = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!MSAL_ENABLED || !isAuthenticated) return
    setLoading(true)
    Promise.all([getMyProfile(instance), getMyPhoto(instance)])
      .then(([prof, ph]) => { setProfile(prof); setPhoto(ph) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [isAuthenticated, instance])

  const login = () => {
    if (!MSAL_ENABLED) return
    instance.loginPopup(loginRequest).catch(console.error)
  }

  const logout = () => {
    if (!MSAL_ENABLED) return
    instance.logoutPopup({ account: accounts[0] }).catch(console.error)
  }

  return {
    isAuthenticated: MSAL_ENABLED && isAuthenticated,
    msalEnabled: MSAL_ENABLED,
    account: accounts[0] || null,
    profile,
    photo,
    loading,
    login,
    logout,
    msal: instance,
  }
}
