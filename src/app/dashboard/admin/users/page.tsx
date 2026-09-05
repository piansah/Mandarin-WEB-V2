"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, Shield, User, Search, MoreVertical,
  CheckCircle2, XCircle, Clock, Trash2, Edit
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getAllUsersWithRoles, updateUserRole, isSuperAdmin, type UserProfileWithRole } from "@/lib/auth-roles"

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = React.useState<UserProfileWithRole[]>([])
  const [loading, setLoading] = React.useState(true)
  const [isSuperAdminUser, setIsSuperAdminUser] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [updatingRole, setUpdatingRole] = React.useState<string | null>(null)
  const [editModalOpen, setEditModalOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<UserProfileWithRole | null>(null)

  React.useEffect(() => {
    async function loadData() {
      try {
        const [usersData, superAdminStatus] = await Promise.all([
          getAllUsersWithRoles(),
          isSuperAdmin()
        ])
        setUsers(usersData)
        setIsSuperAdminUser(superAdminStatus)
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleRoleChange = async (userId: string, newRole: "admin" | "user" | "superadmin") => {
    setUpdatingRole(userId)
    try {
      console.log("Attempting to change role:", { userId, newRole })
      const result = await updateUserRole(userId, newRole)
      console.log("Role change result:", result)
      
      if (result.error) {
        alert(`Gagal mengubah role: ${result.error}`)
        return
      }
      
      // Refresh users list
      const usersData = await getAllUsersWithRoles()
      setUsers(usersData)
      console.log("Users refreshed after role change")
      
      // Close modal if open
      if (editModalOpen) {
        setEditModalOpen(false)
        setEditingUser(null)
      }
    } catch (error) {
      console.error("Error changing role:", error)
      alert("Terjadi kesalahan saat mengubah role")
    } finally {
      setUpdatingRole(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus user ini?")) {
      return
    }
    
    // TODO: Implement delete user logic
    alert("Fitur delete user belum diimplementasikan")
  }

  const openEditModal = (user: UserProfileWithRole) => {
    setEditingUser(user)
    setEditModalOpen(true)
  }

  const closeEditModal = () => {
    setEditModalOpen(false)
    setEditingUser(null)
  }

  const filteredUsers = users.filter(user =>
    user.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.user_id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const adminCount = users.filter(u => u.role === "admin" || u.role === "superadmin").length

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
            {isSuperAdminUser && (
              <Badge>Superadmin</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isSuperAdminUser 
              ? "Kelola semua user dan role" 
              : "Kelola user (read-only)"}
          </p>
        </div>
      </div>

      {/* Search */}
      <Card className="border-muted/50">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari user berdasarkan nama atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card className="border-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Daftar User ({filteredUsers.length})</span>
            <Badge variant="outline">{adminCount} Admin</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "Tidak ada user yang cocok dengan pencarian" : "Belum ada user"}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div
                  key={user.user_id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.display_name || "Unknown"}</span>
                      <span className="text-sm text-muted-foreground">ID: {user.user_id.slice(0, 8)}...</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant={user.role === "admin" || user.role === "superadmin" ? "secondary" : "outline"}
                      className="flex items-center gap-1"
                    >
                      {user.role === "superadmin" ? (
                        <>
                          <Shield className="h-3 w-3" />
                          Superadmin
                        </>
                      ) : user.role === "admin" ? (
                        <>
                          <Shield className="h-3 w-3" />
                          Admin
                        </>
                      ) : (
                        <>
                          <User className="h-3 w-3" />
                          User
                        </>
                      )}
                    </Badge>

                    {isSuperAdminUser ? (
                      // Superadmin: bisa edit dan delete semua user
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <div className={`flex items-center p-2 hover:bg-muted rounded cursor-pointer ${updatingRole === user.user_id ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {updatingRole === user.user_id ? (
                              <Clock className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(user)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Role
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteUser(user.user_id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      // Admin biasa: hanya bisa edit user biasa jadi admin
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <div className={`flex items-center p-2 hover:bg-muted rounded cursor-pointer ${updatingRole === user.user_id ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {updatingRole === user.user_id ? (
                              <Clock className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {user.role === "user" && (
                            <DropdownMenuItem onClick={() => handleRoleChange(user.user_id, "admin")}>
                              <Edit className="h-4 w-4 mr-2" />
                              Jadikan Admin
                            </DropdownMenuItem>
                          )}
                          {user.role === "admin" && (
                            <DropdownMenuItem disabled>
                              <Shield className="h-4 w-4 mr-2" />
                              Admin lain
                            </DropdownMenuItem>
                          )}
                          {user.role === "superadmin" && (
                            <DropdownMenuItem disabled>
                              <Shield className="h-4 w-4 mr-2" />
                              Superadmin
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!isSuperAdminUser && (
        <Card className="border-muted/50 bg-blue-500/5">
          <CardContent className="p-4">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <strong>Info:</strong> Sebagai admin biasa, Anda dapat melihat user biasa dan admin biasa, 
              serta menjadikan user biasa menjadi admin. Untuk akses penuh (kelola superadmin), 
              Anda harus memiliki akses Superadmin.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit Role Modal */}
      {editModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Role User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  User: <span className="font-medium">{editingUser.display_name || "Unknown"}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Role saat ini: <Badge>{editingUser.role}</Badge>
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Pilih role baru:</p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant={editingUser.role === "user" ? "default" : "outline"}
                    onClick={() => handleRoleChange(editingUser.user_id, "user")}
                    disabled={updatingRole === editingUser.user_id}
                  >
                    <User className="h-4 w-4 mr-2" />
                    User
                  </Button>
                  <Button
                    variant={editingUser.role === "admin" ? "default" : "outline"}
                    onClick={() => handleRoleChange(editingUser.user_id, "admin")}
                    disabled={updatingRole === editingUser.user_id}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                  {isSuperAdminUser && (
                    <Button
                      variant={editingUser.role === "superadmin" ? "default" : "outline"}
                      onClick={() => handleRoleChange(editingUser.user_id, "superadmin")}
                      disabled={updatingRole === editingUser.user_id}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Superadmin
                    </Button>
                  )}
                </div>
              </div>
              
              <Button variant="outline" onClick={closeEditModal} className="w-full">
                Batal
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
