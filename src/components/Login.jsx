import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PawPrint, LogIn, ShieldCheck, Stethoscope, UserCheck } from 'lucide-react';

const CUENTAS_PRUEBA = [
  {
    rol: 'Administrador',
    email: 'admin@patitasfelices.cl',
    password: 'abc.123',
    icono: ShieldCheck,
  },
  {
    rol: 'Veterinario',
    email: 'vet@patitasfelices.cl',
    password: 'abc.123',
    icono: Stethoscope,
  },
  {
    rol: 'Recepcionista',
    email: 'recepcion@patitasfelices.cl',
    password: 'abc.123',
    icono: UserCheck,
  },
];

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('admin@patitasfelices.cl');
  const [password, setPassword] = useState('abc.123');
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const iniciarSesion = async (correoIngresado, claveIngresada) => {
    setCargando(true);
    setErrorMsg('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: correoIngresado.trim(),
      password: claveIngresada,
    });

    if (error) {
      setErrorMsg(`No se pudo iniciar sesión: ${error.message}`);
      setCargando(false);
      return;
    }

    if (data?.session && onLoginSuccess) {
      onLoginSuccess(data.session);
    }
    setCargando(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    iniciarSesion(email, password);
  };

  const autocompletarCuenta = (cuenta) => {
    setEmail(cuenta.email);
    setPassword(cuenta.password);
    setErrorMsg('');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f1f5f9',
        padding: '20px',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div
            className="brand-icon"
            style={{ width: 48, height: 48, margin: '0 auto 10px', borderRadius: '12px' }}
          >
            <PawPrint size={26} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
            Clínica Veterinaria Patitas Felices
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Acceso al Sistema Clínico y Control RLS
          </p>
        </div>

        {errorMsg && (
          <div className="alert-banner alert-red" style={{ marginBottom: '16px', fontSize: '13px' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Correo Electrónico</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}
            disabled={cargando}
          >
            <LogIn size={16} />
            {cargando ? 'Validando credenciales...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
            Cuentas de prueba (clave: <code>abc.123</code>):
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {CUENTAS_PRUEBA.map((cuenta) => {
              const Icono = cuenta.icono;
              return (
                <button
                  key={cuenta.email}
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ justifyContent: 'space-between', width: '100%', padding: '8px 12px' }}
                  onClick={() => autocompletarCuenta(cuenta)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icono size={15} color="#0d9488" />
                    <strong>{cuenta.rol}</strong>
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{cuenta.email}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}