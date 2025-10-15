import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import OTPInput from '../../components/OTPInput'

export default function EmailVerification() {
    const [code, setCode] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [resent, setResent] = useState(false)
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (code.length !== 6) {
            return setError('Please enter a valid 6-digit code')
        }

        setError('')
        setLoading(true)

        try {
            // Mock verification
            await new Promise(resolve => setTimeout(resolve, 1000))
            navigate('/')
        } catch (err) {
            setError('Failed to verify email. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleResend = () => {
        setResent(true)
        setTimeout(() => setResent(false), 5000)
    }

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900">Verify Your Email</h2>
                <p className="mt-2 text-gray-600">
                    We've sent a 6-digit code to your email address
                </p>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex justify-center">
                    <OTPInput length={6} onChange={setCode} />
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Verifying...' : 'Verify Email'}
                    </button>
                </div>
            </form>

            <div className="text-center text-sm">
                <p className="text-gray-600">
                    Didn't receive a code?{' '}
                    <button
                        onClick={handleResend}
                        disabled={resent}
                        className={`font-medium text-blue-600 hover:text-blue-500 ${resent ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {resent ? 'Code resent!' : 'Resend code'}
                    </button>
                </p>
            </div>
        </div>
    )
}