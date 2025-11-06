import Link from 'next/link'
import { Home } from 'lucide-react'
import BackButton from '@/components/BackButton'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">Page Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/" className="btn-primary flex items-center gap-2">
            <Home className="h-4 w-4" />
            Go Home
          </Link>

          <BackButton className="btn-secondary flex items-center gap-2" />
        </div>
      </div>
    </div>
  )
}


// import Link from 'next/link'
// import { ArrowLeft, Home } from 'lucide-react'

// export default function NotFound() {
//   return (
//     <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
//       <div className="text-center">
//         <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
//         <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
//           Page Not Found
//         </h2>
//         <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
//           The page you're looking for doesn't exist or has been moved.
//         </p>
        
//         <div className="flex flex-col sm:flex-row gap-4 justify-center">
//           <Link
//             href="/"
//             className="btn-primary flex items-center gap-2"
//           >
//             <Home className="h-4 w-4" />
//             Go Home
//           </Link>
          
//           <button
//             onClick={() => window.history.back()}
//             className="btn-secondary flex items-center gap-2"
//           >
//             <ArrowLeft className="h-4 w-4" />
//             Go Back
//           </button>
//         </div>
//       </div>
//     </div>
//   )
// }
