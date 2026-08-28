// Layout untuk halaman practice — fullscreen tanpa sidebar
// export default function PracticeLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <div className="fixed inset-0 z-50 bg-background flex flex-col">
//       {children}
//     </div>
//   )
// }

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
