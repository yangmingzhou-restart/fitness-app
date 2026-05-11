import { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import AppNavigator from './src/navigation/AppNavigator'
import './src/i18n'

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  )
}
