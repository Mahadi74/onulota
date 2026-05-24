import { AlertCircle, X } from 'lucide-react'
import { useState } from 'react'

interface ErrorMessageProps {
  message: string
  title?: string
  dismissible?: boolean
  onDismiss?: () => void
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  title = 'Error',
  dismissible = true,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(true)

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  if (!isVisible) {
    return null
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900">{title}</h3>
          <p className="text-sm text-red-700 mt-1">{message}</p>
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="text-red-600 hover:text-red-700 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}

interface ErrorListProps {
  errors: string[]
  title?: string
}

export const ErrorList: React.FC<ErrorListProps> = ({
  errors,
  title = 'Errors',
}) => {
  if (errors.length === 0) {
    return null
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900">{title}</h3>
          <ul className="text-sm text-red-700 mt-2 space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
