import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, Switch
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PerlaColors } from '@/constants/theme';
import { supabase } from '@/src/lib/supabase';
import { useToast } from '@/src/contexts/ToastContext';
import { Usuario, RangoUsuario, Embarcacion } from '@/src/lib/database.types';
import { useAuth } from '@/src/contexts/AuthContext';
import { globalEvents } from '@/src/lib/events';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function UsersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { rango: currentUserRango } = useAuth();
  
  const [usuarios, setUsuarios] = useState<(Usuario & { email?: string, activo?: boolean, numero?: string, id_embarcacion?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [embarcaciones, setEmbarcaciones] = useState<Embarcacion[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [manageUser, setManageUser] = useState<any>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNumero, setFormNumero] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRango, setFormRango] = useState<RangoUsuario>('Vendedor');
  const [formIdEmbarcacion, setFormIdEmbarcacion] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('usuario')
        .select('*')
        .neq('rango', 'Comprador')
        .neq('rango', 'Dev')
        .order('nombre');
      if (error) throw error;
      setUsuarios(data || []);

      const { data: barcos, error: ebErr } = await supabase
        .from('embarcacion')
        .select('*')
        .order('nombre');
      if (!ebErr && barcos) {
        setEmbarcaciones(barcos);
      }
    } catch (error: any) {
      toast.error('Error al cargar datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const unsub = globalEvents.on('fab-press-users', () => {
      setShowModal(true);
    });
    return () => unsub();
  }, []);

  const handleCrearEmpleado = async () => {
    if (!formNombre || !formEmail || !formPassword) {
      return toast.warning('Completa todos los campos obligatorios');
    }
    if (formPassword.length < 6) {
      return toast.error('La contraseña debe tener al menos 6 caracteres');
    }
    if (formRango === 'Barco' && !formIdEmbarcacion) {
      return toast.warning('Selecciona un barco para este rol.');
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-crear-empleado', {
        body: {
          nombre: formNombre,
          email: formEmail,
          numero: formNumero,
          password: formPassword,
          rango: formRango,
          id_embarcacion: formRango === 'Barco' ? formIdEmbarcacion : null
        }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('Empleado creado exitosamente');
      setShowModal(false);
      setFormNombre('');
      setFormEmail('');
      setFormNumero('');
      setFormPassword('');
      setFormIdEmbarcacion(null);
      fetchUsers();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Error al crear empleado');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (email?: string) => {
    if (!email) return toast.warning('Este usuario no tiene correo registrado en la base de talles.');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast.success(`Se envió el enlace de recuperación a ${email}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const applyRole = async (user: any, newRole: string) => {
    try {
      const { error } = await supabase.from('usuario').update({ rango: newRole }).eq('id_usuario', user.id_usuario);
      if (error) throw error;
      toast.success(`Rol cambiado a ${newRole}`);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const handleToggleActivo = async (u: any, isActivo: boolean) => {
    try {
      const { error } = await supabase.from('usuario').update({ activo: isActivo }).eq('id_usuario', u.id_usuario);
      if (error) throw error;
      toast.success(`Usuario ${isActivo ? 'activado' : 'desactivado'}`);
      setManageUser((prev: any) => prev ? { ...prev, activo: isActivo } : prev);
      fetchUsers();
    } catch(e: any) {
      toast.error(e.message);
    }
  }

  const handleUpdateUser = async () => {
    if(!manageUser) return;
    try {
      const { error } = await supabase.from('usuario').update({
        nombre: manageUser.nombre,
        numero: manageUser.numero || null,
        rango: manageUser.rango,
        id_embarcacion: manageUser.id_embarcacion || null
      }).eq('id_usuario', manageUser.id_usuario);
      if (error) throw error;
      toast.success('Datos actualizados correctamente');
      setManageUser(null);
      fetchUsers();
    } catch(e: any) {
      toast.error(e.message);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={PerlaColors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Personal</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={PerlaColors.primary} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {usuarios.map(u => (
            <View key={u.id_usuario} style={[styles.userCard, u.activo === false && { opacity: 0.5 }]}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{u.nombre} {u.activo === false && '(Desactivado)'}</Text>
                {u.numero ? <Text style={styles.userEmail}>{u.numero}</Text> : null}
                {u.email ? <Text style={styles.userEmail}>{u.email}</Text> : null}
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{u.rango}</Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                {u.email && u.activo !== false && (
                  <Pressable onPress={() => handleResetPassword(u.email)} style={styles.iconBtn}>
                    <IconSymbol name="key.fill" size={16} color={PerlaColors.onSurface} />
                    <Text style={styles.iconBtnText}>Reiniciar</Text>
                  </Pressable>
                )}
                {u.activo !== false && (
                  <Pressable onPress={() => setManageUser(u)} style={styles.iconBtnOnly} hitSlop={10}>
                    <IconSymbol name="ellipsis.circle.fill" size={24} color={PerlaColors.onSurfaceVariant} />
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView 
          style={styles.modalOverlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo Empleado</Text>

            <ScrollView 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.label}>Nombre completo</Text>
              <TextInput
                style={styles.input}
                value={formNombre}
                onChangeText={setFormNombre}
                placeholder="Juan Pérez"
                placeholderTextColor="#999"
                autoComplete="off"
                textContentType="none"
              />

              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                value={formEmail}
                onChangeText={setFormEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="juan@perlanegra.mx"
                placeholderTextColor="#999"
                autoComplete="off"
                textContentType="none"
              />

              <Text style={styles.label}>Número de teléfono (Opcional)</Text>
              <TextInput
                style={styles.input}
                value={formNumero}
                onChangeText={setFormNumero}
                keyboardType="phone-pad"
                placeholder="Ej. 638..."
                placeholderTextColor="#999"
                autoComplete="off"
                textContentType="none"
              />

              <Text style={styles.label}>Contraseña temporal</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                  value={formPassword}
                  onChangeText={setFormPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#999"
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
                <Pressable 
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.passwordToggle}
                >
                  <IconSymbol 
                    name={showPassword ? "eye.slash.fill" : "eye.fill"} 
                    size={20} 
                    color={PerlaColors.onSurfaceVariant} 
                  />
                </Pressable>
              </View>
              {formPassword.length > 0 && formPassword.length < 6 && (
                <Text style={styles.passwordWarning}>Mínimo 6 caracteres requeridos</Text>
              )}

              <Text style={styles.label}>Rango Asignado</Text>
              <View style={styles.rangoRow}>
                {['Vendedor', 'Barco', 'Caseta', 'Dev'].map(r => {
                  if (r === 'Dev' && currentUserRango !== 'Dev') return null;
                  return (
                    <Pressable
                      key={r}
                      style={[styles.rangoBtn, formRango === r && styles.rangoBtnActive]}
                      onPress={() => setFormRango(r as RangoUsuario)}
                    >
                      <Text style={[styles.rangoBtnText, formRango === r && styles.rangoBtnTextActive]}>{r}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {formRango === 'Barco' && (
                <>
                  <Text style={styles.label}>Barco Asignado</Text>
                  <View style={styles.rangoRow}>
                    {embarcaciones.map(b => (
                      <Pressable
                        key={b.id_embarcacion}
                        style={[styles.rangoBtn, formIdEmbarcacion === b.id_embarcacion && styles.rangoBtnActive]}
                        onPress={() => setFormIdEmbarcacion(b.id_embarcacion)}
                      >
                        <Text style={[styles.rangoBtnText, formIdEmbarcacion === b.id_embarcacion && styles.rangoBtnTextActive]}>{b.nombre}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setShowModal(false)} disabled={saving}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.saveBtn} onPress={handleCrearEmpleado} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Crear</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Manage Options Modal */}
      <Modal visible={!!manageUser} transparent animationType="fade">
        <View style={styles.centerOverlay}>
          <View style={styles.manageModal}>
            <Text style={styles.manageTitle}>Gestionar Usuario</Text>
            
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={manageUser?.nombre || ''}
              onChangeText={t => setManageUser((p: any) => ({ ...p, nombre: t }))}
              autoComplete="off"
              textContentType="none"
            />

            <Text style={styles.label}>Teléfono</Text>
            <TextInput
              style={styles.input}
              value={manageUser?.numero || ''}
              onChangeText={t => setManageUser((p: any) => ({ ...p, numero: t }))}
              keyboardType="phone-pad"
              autoComplete="off"
              textContentType="none"
            />

            {manageUser?.email ? (
              <>
                <Text style={styles.label}>Correo electrónico (No editable)</Text>
                <View style={[styles.input, { backgroundColor: PerlaColors.surfaceContainerHigh }]}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: 16, color: PerlaColors.onSurfaceVariant }}>
                    {manageUser.email}
                  </Text>
                </View>
              </>
            ) : null}
            
            <View style={{ marginTop: 20 }} />

            <Text style={styles.manageSectionTitle}>Nuevo Rol Operativo:</Text>
            <View style={styles.rangoRow}>
              {['Vendedor', 'Barco', 'Caseta'].map(r => (
                <Pressable
                  key={r}
                  style={[styles.rangoBtn, manageUser?.rango === r && styles.rangoBtnActive]}
                  onPress={() => setManageUser((p: any) => ({ ...p, rango: r, id_embarcacion: r === 'Barco' ? p.id_embarcacion : null }))}
                >
                  <Text style={[styles.rangoBtnText, manageUser?.rango === r && styles.rangoBtnTextActive]}>{r}</Text>
                </Pressable>
              ))}
            </View>

            {manageUser?.rango === 'Barco' && (
              <>
                <Text style={[styles.manageSectionTitle, { marginTop: 16 }]}>Asignar Barco:</Text>
                <View style={styles.rangoRow}>
                  {embarcaciones.map(b => (
                    <Pressable
                      key={b.id_embarcacion}
                      style={[styles.rangoBtn, manageUser?.id_embarcacion === b.id_embarcacion && styles.rangoBtnActive]}
                      onPress={() => setManageUser((p: any) => ({ ...p, id_embarcacion: b.id_embarcacion }))}
                    >
                      <Text style={[styles.rangoBtnText, manageUser?.id_embarcacion === b.id_embarcacion && styles.rangoBtnTextActive]}>{b.nombre}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Usuario Activo</Text>
              <Switch 
                value={manageUser?.activo !== false} 
                onValueChange={(val) => handleToggleActivo(manageUser, val)} 
                trackColor={{ false: "#767577", true: PerlaColors.primary }}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtnManage} onPress={() => setManageUser(null)}>
                <Text style={styles.cancelBtnTextManage}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleUpdateUser}>
                <Text style={styles.saveBtnText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 16,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  title: { flex: 1, fontFamily: 'Newsreader-Bold', fontSize: 32, color: PerlaColors.onSurface },
  
  listContent: { padding: 20, gap: 16, paddingBottom: 120 },
  userCard: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: PerlaColors.surfaceContainerLow,
    padding: 16, borderRadius: 16
  },
  userInfo: { flex: 1 },
  userName: { fontFamily: 'Manrope-Bold', fontSize: 18, color: PerlaColors.onSurface },
  userEmail: { fontFamily: 'Manrope', fontSize: 13, color: PerlaColors.onSurfaceVariant, marginTop: 2 },
  badge: { 
    alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, backgroundColor: PerlaColors.tertiary + '20', borderWidth: 1, borderColor: PerlaColors.tertiary + '40'
  },
  badgeText: { fontFamily: 'Manrope-Bold', fontSize: 11, color: PerlaColors.tertiary },
  
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: PerlaColors.surfaceContainerHigh, borderRadius: 8 },
  iconBtnText: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: PerlaColors.onSurface, marginLeft: 6 },
  iconBtnOnly: { padding: 6 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: PerlaColors.surfaceContainerLow, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  modalTitle: { fontFamily: 'Newsreader', fontSize: 28, color: PerlaColors.onSurface, marginBottom: 12 },
  
  centerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  manageModal: { width: '100%', maxWidth: 400, backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 24, padding: 24 },
  manageTitle: { fontFamily: 'Newsreader-Bold', fontSize: 24, color: PerlaColors.onSurface, marginBottom: 4 },
  userToManageName: { fontFamily: 'Manrope-SemiBold', fontSize: 14, color: PerlaColors.onSurfaceVariant, marginBottom: 20 },
  manageSectionTitle: { fontFamily: 'Manrope-Bold', fontSize: 12, color: PerlaColors.onSurfaceVariant, marginBottom: 10, textTransform: 'uppercase' },
  
  divider: { height: 1, backgroundColor: PerlaColors.outlineVariant, opacity: 0.3, marginVertical: 20 },
  
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, borderRadius: 12, backgroundColor: '#FF525215', borderWidth: 1, borderColor: '#FF525230' },
  dangerBtnText: { fontFamily: 'Manrope-Bold', fontSize: 14, color: '#FF5252' },
  
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, backgroundColor: PerlaColors.surfaceContainerHigh, borderRadius: 12, paddingRight: 12, paddingLeft: 16 },
  switchLabel: { fontFamily: 'Manrope-Bold', fontSize: 14, color: PerlaColors.onSurface },

  cancelBtnManage: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: PerlaColors.surfaceContainerHigh, alignItems: 'center' },
  cancelBtnTextManage: { fontFamily: 'Manrope-Bold', fontSize: 16, color: PerlaColors.onSurface },
  
  label: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: PerlaColors.onSurfaceVariant, marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: PerlaColors.surfaceContainer, borderRadius: 12, padding: 14,
    fontFamily: 'Manrope', fontSize: 16, color: PerlaColors.onSurface,
    borderWidth: 1, borderColor: PerlaColors.outlineVariant + '30'
  },
  
  rangoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  rangoBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainerHigh, borderWidth: 1, borderColor: 'transparent' },
  rangoBtnActive: { backgroundColor: PerlaColors.primary + '15', borderColor: PerlaColors.primary },
  rangoBtnText: { fontFamily: 'Manrope-Medium', fontSize: 13, color: PerlaColors.onSurfaceVariant },
  rangoBtnTextActive: { fontFamily: 'Manrope-Bold', color: PerlaColors.primary },
  
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 32 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: PerlaColors.surfaceContainerHigh, alignItems: 'center' },
  cancelBtnText: { fontFamily: 'Manrope-Bold', fontSize: 16, color: PerlaColors.onSurface },
  saveBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: PerlaColors.tertiary, alignItems: 'center' },
  saveBtnText: { fontFamily: 'Manrope-Bold', fontSize: 16, color: PerlaColors.onTertiary },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordToggle: {
    backgroundColor: PerlaColors.surfaceContainer,
    height: 54, // Match input height roughly
    paddingHorizontal: 16,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: PerlaColors.outlineVariant + '30'
  },
  passwordWarning: {
    color: '#EF5350',
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});
