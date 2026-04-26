'use client'

import { FormEvent, useState, useEffect } from 'react'
import axios from 'axios'
import MessageBubble from '../components/message' // Adjusted path
import CategorizedDiagnosticCodeSelector from '../components/CategorizedDiagnosticCodeSelector' // Adjusted path
import { FiSend } from 'react-icons/fi'
import Image from 'next/image'
import { useCustomAuth } from '@/hooks/useCustomAuth'
import { makeAuthenticatedRequest } from '@/hooks/useCustomAuth'
import { useRouter } from 'next/navigation'
// Health effects are searched from /api/health-effects using CSV data
 
 type Food = {
   name: string
   calories: number | string
   protein: number | string
 }
 
 type SpoonacularRecipe = {
   title: string
   image: string
 }
 
 type NutritionResp = {
   usdaData?: Food[]
   spoonacularData?: SpoonacularRecipe[]
 }
 
 type InstacartMeta = {
   products_link_url: string
   image_url?: string
 }

type Message = {
  id: number
  text: string
  role: 'user' | 'assistant' | 'error'
}

type DiagnosticCode = {
  code: string
  name: string
}

type UserProfile = {
  name?: string | null
  age?: number | null
  gender?: string | null
}

export default function ChatInterface() {
  const { user, isAuthenticated, isLoading, signOut } = useCustomAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedDiagnosticCodes, setSelectedDiagnosticCodes] = useState<DiagnosticCode[]>([])
  const [complexity, setComplexity] = useState<number>(3)
  const [healthEffectIdsText, setHealthEffectIdsText] = useState('')
  type HealthEffect = { id: number; name: string; description?: string }
  const [healthSearch, setHealthSearch] = useState('')
  const [healthResults, setHealthResults] = useState<HealthEffect[]>([])
  const [selectedHealthEffects, setSelectedHealthEffects] = useState<HealthEffect[]>([])
  const [showAdvancedHealthIds, setShowAdvancedHealthIds] = useState(false)
  const [nutrition, setNutrition] = useState<NutritionResp | null>(null)
  const [instacart, setInstacart] = useState<InstacartMeta | null>(null)
  const [userProfile] = useState<UserProfile>({})

  const handleCodeSelection = (code: DiagnosticCode) => {
    setSelectedDiagnosticCodes(prev => {
      if (prev.find(c => c.code === code.code)) {
        return prev.filter(c => c.code !== code.code); // Unselect if already selected
      } else {
        return [...prev, code]; // Select if not already selected
      }
    });
  };

  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() && selectedDiagnosticCodes.length === 0) return

    const codesText = selectedDiagnosticCodes
      .map(c => `[Code: ${c.code} - ${c.name}]`)
      .join('\n');
    
    const messageText = selectedDiagnosticCodes.length > 0
      ? `${codesText}\n${inputValue}`
      : inputValue

    setMessages(prev => [
      ...prev,
      { id: prev.length + 1, text: messageText, role: 'user' }
    ])
    setInputValue('')
    setLoading(true)

    try {
      const parsedIdsFromText = healthEffectIdsText
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(Number)
        .filter(n => Number.isFinite(n))

      const selectedIds = selectedHealthEffects.map(e => e.id)
      const healthEffectIds = selectedIds.length > 0
        ? selectedIds
        : parsedIdsFromText

      console.log('[UI] healthEffectIds parsed:', healthEffectIds)

      const payload = {
        query: messageText,
        diagnosticCodes: selectedDiagnosticCodes,
        complexity,
        healthEffectIds: healthEffectIds.length > 0 ? healthEffectIds : undefined
      }

      console.log('[UI] Sending /api/chat payload:', {
        queryPreview: messageText.slice(0, 80),
        diagnosticCodesCount: selectedDiagnosticCodes.length,
        complexity,
        healthEffectIds: payload.healthEffectIds
      })

      // Use authenticated request
      const response = await makeAuthenticatedRequest('/api/chat', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
      }

      const data = await response.json();

      console.log('API Response:', data)

      let cleanResponse = data.enhancedResponse
      if (cleanResponse && cleanResponse.startsWith('Response:')) {
        cleanResponse = cleanResponse.replace('Response:', '').trim()
      }

      setMessages(prev => [
        ...prev,
        { id: prev.length + 1, text: cleanResponse, role: 'assistant' }
      ])
      // Capture nutrition + instacart metadata for UI
      setNutrition(data?.nutrition || null)
      setInstacart(data?.instacart || null)
    } catch (error) {
      console.error('Error fetching GPT response:', error)
      // Show the actual error message to the user
      const errorMessage = error instanceof Error ? error.message : 'Error fetching response. Please try again.';
      setMessages(prev => [
        ...prev,
        {
          id: prev.length + 1,
          text: `❌ Error: ${errorMessage}`,
          role: 'error'
        }
      ])
    } finally {
      setLoading(false)
      // Decide if you want to clear codes after submission. For now, we won't.
      // setSelectedDiagnosticCodes([]);
    }
  }

  return (
    <>
      {/* Plain <style> tag instead of styled-jsx — Next.js 16 strict TS
          types reject the `jsx`/`global` props since styled-jsx isn't an
          explicit dependency. Same runtime effect. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes underline-reveal {
              from { width: 0%; }
              to { width: 100%; }
            }
            .animate-underline-reveal::after {
              content: '';
              position: absolute;
              left: 0;
              bottom: -6px;
              height: 1.5px;
              background-color: currentColor;
              animation: underline-reveal 0.6s ease-out forwards;
              animation-delay: 0.2s;
            }
            .animation-delay-200 { animation-delay: 0.2s; }
            .animation-delay-400 { animation-delay: 0.4s; }
          `,
        }}
      />
      <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-gray-200">
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-800">
                  Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}
                </h2>
                <p className="text-sm text-gray-500">Welcome back, {user?.email || 'Guest'}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  {new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 grid-rows-[1fr] gap-6 p-6 flex-1 overflow-hidden min-h-0">
            {/* Patient Info Panel */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 relative overflow-hidden group animate-[fadeIn_0.5s_ease-out] h-full min-h-0">
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-tr from-rose-200 to-rose-400 opacity-40 blur-2xl group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-2xl font-bold shadow-lg animate-[float_6s_ease-in-out_infinite]">
                  A
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Patient</p>
                  <h3 className="text-xl font-semibold text-gray-800">
                    {userProfile.name || 'Guest'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {[
                      userProfile.gender ? userProfile.gender.replace(/_/g, ' ') : null,
                      userProfile.age ? `${userProfile.age}` : null,
                      'Active',
                    ]
                      .filter(Boolean)
                      .join(' • ') || 'Active'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-6">
                <div className="rounded-xl bg-gray-50 p-3 hover:bg-gray-100 transition-colors">
                  <p className="text-[10px] text-gray-500">Appointments</p>
                  <p className="text-lg font-semibold text-gray-800">3</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 hover:bg-gray-100 transition-colors">
                  <p className="text-[10px] text-gray-500">Messages</p>
                  <p className="text-lg font-semibold text-gray-800">{messages.length}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 hover:bg-gray-100 transition-colors">
                  <p className="text-[10px] text-gray-500">Codes</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedDiagnosticCodes.length}</p>
                </div>
              </div>
            </div>

            {/* Chat Card */}
            <div className="lg:col-span-2 xl:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col animate-[fadeInUp_0.6s_ease-out] h-full min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto p-6">
                {messages.length === 0 && (
                  <div className="text-center mt-20">
                    <div style={{marginBottom: '-20px'}}>
                      <Image
                        src="/pictures/culinAI.png"
                        alt="CulinAI Logo"
                        width={100}
                        height={100}
                        className="mx-auto"
                        priority
                      />
                    </div>
                    <p className="text-gray-500 text-lg max-w-md mx-auto">
                      Your personal culinary assistant.
                    </p>
                  </div>
                )}
                <div className="space-y-6 mx-auto max-w-3xl">
                  {messages.map(message => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {loading && (
                    <div className="flex items-center justify-center space-x-2 mt-4">
                      <div className="animate-bounce w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
                      <div className="animate-bounce w-2.5 h-2.5 bg-gray-400 rounded-full animation-delay-200"></div>
                      <div className="animate-bounce w-2.5 h-2.5 bg-gray-400 rounded-full animation-delay-400"></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-200 p-4">
                <form onSubmit={handleSubmit} className="flex gap-4 items-center">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder={selectedDiagnosticCodes.length > 0 ? "Add details or ask a question..." : "Ask about nutrition, recipes, or health..."}
                    className="w-full px-6 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-700 placeholder-gray-400 bg-gray-50 transition-all duration-200 focus:shadow-md"
                  />
                  <button
                    type="submit"
                    disabled={loading || (!inputValue.trim() && selectedDiagnosticCodes.length === 0)}
                    className="bg-[#8cc342] hover:bg-indigo-700 disabled:bg-[#8cc342] p-3 rounded-full w-14 h-14 text-white flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <FiSend size={20} />
                  </button>
                </form>
              </div>
            </div>

            {/* Controls / Insights */}
            <div className="space-y-6 overflow-y-auto pr-1 animate-[fadeIn_0.7s_ease-out] h-full min-h-0">
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">Recipe Complexity</h3>
                  <span className="text-sm text-gray-600">{complexity}</span>
                </div>
                <input
                  id="complexity"
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={complexity}
                  onChange={(e) => setComplexity(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-2">1: simple • 5: advanced</p>
              </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-2">Health Effects (optional)</h3>
              <p className="text-xs text-gray-500 mb-3">Search health effects to guide flavor recommendations.</p>

              <input
                type="text"
                value={healthSearch}
                onChange={async (e) => {
                  const v = e.target.value
                  setHealthSearch(v)
                  if (v.trim().length < 2) {
                    setHealthResults([])
                    return
                  }
                  try {
                    const resp = await axios.get('/api/health-effects', { params: { q: v.trim() } })
                    setHealthResults(Array.isArray(resp.data?.results) ? resp.data.results : [])
                  } catch (err) {
                    setHealthResults([])
                  }
                }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const q = healthSearch.trim()
                    if (q.length < 2) return
                    try {
                      const resp = await axios.get('/api/health-effects', { params: { q } })
                      const results = Array.isArray(resp.data?.results) ? resp.data.results : []
                      if (results.length > 0) {
                        const top = results[0]
                        setSelectedHealthEffects(prev => prev.find(x => x.id === top.id) ? prev : [...prev, top])
                        setHealthSearch('')
                        setHealthResults([])
                      }
                    } catch (err) {
                      // ignore
                    }
                  }
                }}
                placeholder="Search health effects... (press Enter to add top match)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
              />

              {healthResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y mb-3 max-h-52 overflow-auto">
                  {healthResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedHealthEffects(prev => prev.find(x => x.id === r.id) ? prev : [...prev, r])
                        setHealthSearch('')
                        setHealthResults([])
                      }}
                      className="w-full text-left p-2 hover:bg-gray-50"
                    >
                      <div className="text-sm text-gray-800 font-medium">{r.name}</div>
                      {r.description && (
                        <div className="text-xs text-gray-500 truncate">{r.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {selectedHealthEffects.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedHealthEffects.map(ef => (
                    <span key={ef.id} className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs flex items-center gap-1">
                      {ef.name}
                      <button
                        type="button"
                        onClick={() => setSelectedHealthEffects(prev => prev.filter(x => x.id !== ef.id))}
                        className="ml-1 text-green-700 hover:text-green-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowAdvancedHealthIds(v => !v)}
                className="text-xs text-gray-600 underline mb-2"
              >
                {showAdvancedHealthIds ? 'Hide' : 'Show'} advanced: enter numeric IDs manually
              </button>

              {showAdvancedHealthIds && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Enter numeric IDs separated by commas (fallback).</p>
                  <input
                    type="text"
                    value={healthEffectIdsText}
                    onChange={e => setHealthEffectIdsText(e.target.value)}
                    placeholder="e.g. 1, 5, 23"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}
            </div>

              {selectedDiagnosticCodes.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                  <h3 className="font-semibold text-gray-800 mb-3">Selected Diagnostic Codes</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedDiagnosticCodes.map(code => (
                      <span key={code.code} className="flex items-center bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                        {code.code} - {code.name}
                        <button
                          type="button"
                          onClick={() => handleCodeSelection(code)}
                          className="ml-2 text-indigo-500 hover:text-indigo-700 font-bold"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {nutrition && (nutrition.spoonacularData?.length || nutrition.usdaData?.length) ? (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Nutrition & Recipe Context</h3>
                {nutrition.spoonacularData && nutrition.spoonacularData.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Similar recipes:</p>
                    <div className="grid grid-cols-2 gap-3">
                      {nutrition.spoonacularData.slice(0, 4).map((r, idx) => (
                        <div key={idx} className="border rounded-lg overflow-hidden">
                          <div className="w-full h-28 bg-gray-100 overflow-hidden">
                            {/* Use img to avoid Next remote image domain config */}
                            <img src={r.image} alt={r.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="p-2 text-xs text-gray-800 line-clamp-2">{r.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {nutrition.usdaData && nutrition.usdaData.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">USDA foods (top 3):</p>
                    <ul className="space-y-1">
                      {nutrition.usdaData.slice(0, 3).map((f, idx) => (
                        <li key={idx} className="text-xs text-gray-700">
                          <span className="font-medium">{f.name}</span>
                          {` — ${f.calories} kcal, ${f.protein}g protein`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            {instacart?.products_link_url ? (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Shop Ingredients</h3>
                {instacart.image_url ? (
                  <div className="w-full h-40 bg-gray-100 overflow-hidden rounded-lg mb-3">
                    <img src={instacart.image_url} alt="Instacart Recipe" className="w-full h-full object-cover" />
                  </div>
                ) : null}
                <a
                  href={instacart.products_link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                >
                  Open Instacart Recipe
                </a>
              </div>
            ) : null}

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Diagnostic Code Selector</h3>
                <CategorizedDiagnosticCodeSelector 
                  onToggle={handleCodeSelection} 
                  selectedCodes={selectedDiagnosticCodes}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
                  <p className="text-xs text-gray-500">Messages</p>
                  <p className="text-2xl font-semibold text-gray-800">{messages.length}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
                  <p className="text-xs text-gray-500">Codes Selected</p>
                  <p className="text-2xl font-semibold text-gray-800">{selectedDiagnosticCodes.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
} 