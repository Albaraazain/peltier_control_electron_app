import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { 
  Settings, 
  Network, 
  Save, 
  TestTube, 
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft
} from 'lucide-react'

const SettingsPage = ({ onBack }) => {
  const [settings, setSettings] = useState({
    modbus: {
      host: '10.5.5.95',
      port: 502,
      unitId: 1,
      timeout: 5000
    },
    ui: {
      theme: 'light',
      pollingInterval: 2000,
      maxDataPoints: 100
    }
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [discoveredDevices, setDiscoveredDevices] = useState([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanResults, setScanResults] = useState([])

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    if (!window.electronAPI) return
    
    try {
      const loadedSettings = await window.electronAPI.loadSettings()
      setSettings(loadedSettings)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const handleSettingChange = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }))
  }

  const handleSave = async () => {
    if (!window.electronAPI) return
    
    setIsLoading(true)
    try {
      const success = await window.electronAPI.saveSettings(settings)
      if (success) {
        // Reconnect with new settings
        await window.electronAPI.disconnectModbus()
        await window.electronAPI.connectToModbus(settings.modbus)
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestConnection = async () => {
    if (!window.electronAPI) return
    
    setIsTesting(true)
    setTestResult(null)
    
    try {
      const result = await window.electronAPI.connectToModbus(settings.modbus)
      setTestResult(result ? 'success' : 'error')
    } catch (error) {
      setTestResult('error')
    } finally {
      setIsTesting(false)
    }
  }

  const handleDiscoverDevices = async () => {
    if (!window.electronAPI) return
    
    setIsDiscovering(true)
    setDiscoveredDevices([])
    
    try {
      const devices = await window.electronAPI.discoverPLCs('10.5.5')
      setDiscoveredDevices(devices || [])
    } catch (error) {
      console.error('Device discovery failed:', error)
    } finally {
      setIsDiscovering(false)
    }
  }

  const handleSelectDevice = (device) => {
    setSettings(prev => ({
      ...prev,
      modbus: {
        ...prev.modbus,
        host: device.ip,
        port: device.port
      }
    }))
  }

  const handleScanFunctions = async () => {
    if (!window.electronAPI) return
    
    setIsScanning(true)
    setScanResults([])
    
    try {
      const results = await window.electronAPI.scanModbusFunctions()
      setScanResults(results || [])
      console.log('📊 Function scan results:', results)
    } catch (error) {
      console.error('Function scan failed:', error)
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Settings</h1>
          </div>
          
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Modbus Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Network className="h-5 w-5 mr-2" />
                Modbus TCP Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="host">PLC Host IP</Label>
                  <Input
                    id="host"
                    type="text"
                    value={settings.modbus.host}
                    onChange={(e) => handleSettingChange('modbus', 'host', e.target.value)}
                    placeholder="10.5.5.95"
                  />
                </div>
                <div>
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={settings.modbus.port}
                    onChange={(e) => handleSettingChange('modbus', 'port', parseInt(e.target.value))}
                    placeholder="502"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unitId">Unit ID</Label>
                  <Input
                    id="unitId"
                    type="number"
                    value={settings.modbus.unitId}
                    onChange={(e) => handleSettingChange('modbus', 'unitId', parseInt(e.target.value))}
                    placeholder="1"
                  />
                </div>
                <div>
                  <Label htmlFor="timeout">Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={settings.modbus.timeout}
                    onChange={(e) => handleSettingChange('modbus', 'timeout', parseInt(e.target.value))}
                    placeholder="5000"
                  />
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex-1"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>

                <Button 
                  variant="outline" 
                  onClick={handleScanFunctions}
                  disabled={isScanning}
                  className="flex-1"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Scan Functions
                    </>
                  )}
                </Button>
                
                {testResult && (
                  <Badge variant={testResult === 'success' ? 'success' : 'destructive'}>
                    {testResult === 'success' ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Failed
                      </>
                    )}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* UI Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>UI Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="pollingInterval">Polling Interval (ms)</Label>
                <Input
                  id="pollingInterval"
                  type="number"
                  value={settings.ui.pollingInterval}
                  onChange={(e) => handleSettingChange('ui', 'pollingInterval', parseInt(e.target.value))}
                  placeholder="2000"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  How often to read temperature data
                </p>
              </div>
              
              <div>
                <Label htmlFor="maxDataPoints">Max Data Points</Label>
                <Input
                  id="maxDataPoints"
                  type="number"
                  value={settings.ui.maxDataPoints}
                  onChange={(e) => handleSettingChange('ui', 'maxDataPoints', parseInt(e.target.value))}
                  placeholder="100"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Maximum points to show in temperature chart
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Device Discovery */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Search className="h-5 w-5 mr-2" />
                PLC Device Discovery
              </span>
              <Button 
                variant="outline" 
                onClick={handleDiscoverDevices}
                disabled={isDiscovering}
              >
                {isDiscovering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Scan Network
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {discoveredDevices.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Found {discoveredDevices.length} device(s) on the network:
                </p>
                {discoveredDevices.map((device, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                    onClick={() => handleSelectDevice(device)}
                  >
                    <div>
                      <p className="font-medium">{device.ip}:{device.port}</p>
                      <p className="text-sm text-muted-foreground">
                        Status: {device.status}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            ) : !isDiscovering ? (
              <div className="text-center py-8 text-muted-foreground">
                <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click "Scan Network" to discover PLCs on your network</p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin opacity-50" />
                <p>Scanning network for Modbus devices...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium">Current Settings:</p>
                <p className="text-sm text-muted-foreground">
                  {settings.modbus.host}:{settings.modbus.port}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Polling Rate:</p>
                <p className="text-sm text-muted-foreground">
                  {settings.ui.pollingInterval}ms
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Chart Points:</p>
                <p className="text-sm text-muted-foreground">
                  {settings.ui.maxDataPoints} max
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Theme:</p>
                <p className="text-sm text-muted-foreground">
                  {settings.ui.theme}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SettingsPage