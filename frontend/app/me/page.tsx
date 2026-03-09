'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/context';
import { Button, Card, Input, Skeleton, ErrorMessage, Badge } from '@/components/ui';
import { roleColor, roleLabel, formatDate } from '@/lib/utils';
import { User, Mail, Calendar, Building, Edit2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema } from '@/lib/schemas';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type FormData = z.infer<typeof updateProfileSchema>;

export default function ProfilePage() {
  const { isAuthenticated, loading, refreshUser } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: isAuthenticated,
  });

  const updateMut = useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: () => {
      toast.success('Profile updated');
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['me'] });
      refreshUser();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(updateProfileSchema),
  });

  if (!loading && !isAuthenticated) {
    router.replace('/login');
    return null;
  }

  if (isLoading || loading) return (
    <div className="container mx-auto px-4 py-10 max-w-lg">
      <Skeleton className="h-48 mb-4" />
      <Skeleton className="h-64" />
    </div>
  );

  if (error) return (
    <div className="container mx-auto px-4 py-10">
      <ErrorMessage message={(error as Error).message} onRetry={refetch} />
    </div>
  );

  if (!user) return null;

  const startEdit = () => {
    reset({ full_name: user.full_name, username: user.username, club_affiliation: user.club_affiliation });
    setEditing(true);
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-lg">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-black mb-6">My Profile</h1>

        <Card className="p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-black text-primary">
                  {user.username?.[0]?.toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="font-display font-bold text-lg">{user.username}</h2>
                {user.full_name && <p className="text-muted-foreground text-sm">{user.full_name}</p>}
                <Badge className={`mt-1 ${roleColor(user.role)}`}>{roleLabel(user.role)}</Badge>
              </div>
            </div>
            <button onClick={startEdit}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary transition-all">
              <Edit2 className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Mail className="w-4 h-4" />
              <span>{user.email}</span>
            </div>
            {user.club_affiliation && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Building className="w-4 h-4" />
                <span>{user.club_affiliation}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Joined {formatDate(user.created_at)}</span>
            </div>
          </div>
        </Card>

        {editing && (
          <Card className="p-5">
            <h3 className="font-display font-semibold mb-4">Edit Profile</h3>
            <form onSubmit={handleSubmit(d => updateMut.mutate(d))} className="space-y-4">
              <Input label="Full name" error={errors.full_name?.message} {...register('full_name')} />
              <Input label="Username" error={errors.username?.message} {...register('username')} />
              <Input label="Club affiliation" error={errors.club_affiliation?.message} {...register('club_affiliation')} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" type="button" onClick={() => setEditing(false)}>Cancel</Button>
                <Button type="submit" loading={updateMut.isPending}>
                  <Check className="w-4 h-4" /> Save changes
                </Button>
              </div>
            </form>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
