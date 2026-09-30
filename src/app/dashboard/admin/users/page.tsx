"use client"
import { toast } from "sonner";

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Shield, User, Search, MoreVertical,
  CheckCircle2, XCircle, Clock, Trash2, Edit, AlertTriangle
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false)
  const [userToDelete, setUserToDelete] = React.useState<UserProfileWithRole | null>(null)

  const [roleFilter, setRoleFilter] = React.useState<"all" | "user" | "admin" | "superadmin">("all")

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

      const result = await updateUserRole(userId, newRole)

      
      if (result.error) {
        toast.error(`Gagal mengubah role: ${result.error}`)
        return
      }
      
      // Refresh users list
      const usersData = await getAllUsersWithRoles()
      setUsers(usersData)

      
      // Close modal if open
      if (editModalOpen) {
        setEditModalOpen(false)
        setEditingUser(null)
      }
    } catch (error) {
      console.error("Error changing role:", error)
      toast.error("Terjadi kesalahan saat mengubah role")
    } finally {
      setUpdatingRole(null)
    }
  }

  const handleDeleteUser = (userId: string) => {
    const user = users.find(u => u.user_id === userId)
    if (user) {
      setUserToDelete(user)
      setDeleteModalOpen(true)
    }
  }

  const confirmDeleteUser = async () => {
    if (!userToDelete) return
    
    // TODO: Implement actual delete user logic when endpoint is ready
    toast.error(`Fitur delete user ${userToDelete.display_name} belum diimplementasikan di backend.`)
    setDeleteModalOpen(false)
    setUserToDelete(null)
  }

  const closeDeleteModal = () => {
    setDeleteModalOpen(false)
    setUserToDelete(null)
  }
  const openEditModal = (user: UserProfileWithRole) => {
    setEditingUser(user)
    setEditModalOpen(true)
  }

  const closeEditModal = () => {
    setEditModalOpen(false)
    setEditingUser(null)
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.user_id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    return matchesSearch && matchesRole
  })

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

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari user berdasarkan nama atau email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <select
          value={roleFilter}
          // eslint-disable-next-line
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">Semua Role</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>
      </div>

      {/* Users List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">Daftar User ({filteredUsers.length})</span>
          <Badge variant="outline">{adminCount} Admin</Badge>
        </div>
        {filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? "Tidak ada user yang cocok dengan pencarian" : "Belum ada user"}
          </div>
        ) : (
          <div className="rounded-lg border border-muted/50 bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {filteredUsers.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span>{user.display_name || "Unknown"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {user.user_id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === "admin" || user.role === "superadmin" ? "secondary" : "outline"}
                      className="flex items-center gap-1 w-max"
                    >
                      {user.role === "superadmin" ? (
                        <><Shield className="h-3 w-3" />Superadmin</>
                      ) : user.role === "admin" ? (
                        <><Shield className="h-3 w-3" />Admin</>
                      ) : (
                        <><User className="h-3 w-3" />User</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {user.title_id || "Belum ada title"}
                  </TableCell>
                  <TableCell>
                    {user.unlocked_tiers && user.unlocked_tiers.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.unlocked_tiers.map((tier) => (
                          <Badge key={tier} variant="outline" className="text-xs capitalize">{tier}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                        {isSuperAdminUser ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger>
                              <div className={`flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted cursor-pointer transition-colors ${updatingRole === user.user_id ? 'opacity-50 pointer-events-none' : ''}`}>
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
                          <DropdownMenu>
                      <DropdownMenuTrigger>
                        <div className={`flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted cursor-pointer transition-colors ${updatingRole === user.user_id ? 'opacity-50 pointer-events-none' : ''}`}>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )}
  </div>

  {!isSuperAdminUser && (
    <p className="text-sm text-blue-700 dark:text-blue-400">
      <strong>Info:</strong> Sebagai admin biasa, Anda dapat melihat user biasa dan admin biasa,
      serta menjadikan user biasa menjadi admin. Untuk akses penuh (kelola superadmin),
      Anda harus memiliki akses Superadmin.
    </p>
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
              Role saat ini: <span className="font-medium capitalize text-foreground">{editingUser.role}</span>
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

  {/* Delete User Modal */}
  {deleteModalOpen && userToDelete && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-center">Hapus User</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            Apakah Anda yakin ingin menghapus user <strong className="text-foreground">{userToDelete.display_name || "Unknown"}</strong>? Tindakan ini tidak dapat dibatalkan.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="outline" onClick={closeDeleteModal} className="flex-1">
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmDeleteUser} className="flex-1">
              Hapus
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )}
    </div>
  )
}
