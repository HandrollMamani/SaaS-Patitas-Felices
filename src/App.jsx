import { useEffect, useState, useMemo } from "react";
import { supabase, configValida } from "./lib/supabaseClient";
import Login from "./components/Login";
import {
  PawPrint,
  LayoutDashboard,
  Calendar,
  Stethoscope,
  Package,
  DollarSign,
  Search,
  LogOut,
  MessageCircle,
  AlertTriangle,
  ShieldAlert,
  Lock,
  Plus,
  Check,
  Syringe,
} from "lucide-react";

export default function App() {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [errorPerfil, setErrorPerfil] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Datos principales del SaaS
  const [clientes, setClientes] = useState([]);
  const [mascotas, setMascotas] = useState([]);
  const [veterinarios, setVeterinarios] = useState([]);
  const [citas, setCitas] = useState([]);
  const [atenciones, setAtenciones] = useState([]);
  const [vacunas, setVacunas] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [movimientosCaja, setMovimientosCaja] = useState([]);

  // Buscador Global Instantáneo (RF-28 / RNF-05)
  const [busquedaGlobal, setBusquedaGlobal] = useState("");
  const [mascotaSeleccionadaId, setMascotaSeleccionadaId] = useState(null);
  const [notificacion, setNotificacion] = useState(null);

  // Estados de Formularios
  const [nuevoCliente, setNuevoCliente] = useState({
    rut: "",
    nombre: "",
    telefono: "569",
    email: "",
    direccion: "",
  });
  const [nuevaMascota, setNuevaMascota] = useState({
    cliente_id: "",
    nombre: "",
    especie: "Perro",
    raza: "",
    sexo: "Macho",
  });
  const [nuevaCita, setNuevaCita] = useState({
    mascota_id: "",
    veterinario_id: "",
    fecha_hora: "",
    tipo: "regular",
  });
  const [nuevaAtencion, setNuevaAtencion] = useState({
    peso_kg: "",
    sintomas: "",
    diagnostico: "",
    tratamiento: "",
    insumo_id: "",
    insumo_cantidad: 1,
  });
  const [nuevaVacuna, setNuevaVacuna] = useState({
    tipo: "vacuna",
    nombre_producto: "",
    proxima_dosis: "",
  });
  const [nuevoMovimiento, setNuevoMovimiento] = useState({
    tipo: "ingreso",
    concepto: "",
    monto: "",
    metodo_pago: "efectivo",
    producto_venta_id: "",
    cantidad_venta: 1,
  });
  const [nuevoProducto, setNuevoProducto] = useState({
    proveedor_id: "",
    nombre: "",
    categoria: "Medicamentos",
    stock_actual: 10,
    stock_minimo: 5,
    precio_venta: "",
  });

  const mostrarMensaje = (texto, tipo = "teal") => {
    setNotificacion({ texto, tipo });
    setTimeout(() => setNotificacion(null), 5000);
  };

  // 1. Control de Sesión desacoplado de consultas a BD
  useEffect(() => {
    if (!configValida || !supabase) {
      setLoadingAuth(false);
      return;
    }

    let montado = true;

    supabase.auth
      .getSession()
      .then(({ data: { session: sesionInicial } }) => {
        if (!montado) return;
        setSession(sesionInicial);
        if (!sesionInicial) setLoadingAuth(false);
      })
      .catch((err) => {
        console.error("Error al obtener sesión inicial:", err);
        if (montado) setLoadingAuth(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
      if (!montado) return;
      setSession(nuevaSesion);
      if (!nuevaSesion) {
        setPerfil(null);
        setErrorPerfil("");
        setLoadingAuth(false);
      }
    });

    return () => {
      montado = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Cargar perfil y rol (con autocreación de respaldo si la fila aún no existe)
  useEffect(() => {
    if (!configValida || !supabase) return;
    const user = session?.user;
    if (!user?.id) return;

    let activo = true;

    const obtenerOCrearPerfil = async () => {
      setLoadingAuth(true);
      setErrorPerfil("");

      const { data, error } = await supabase
        .from("perfiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!activo) return;

      if (error) {
        setErrorPerfil(
          `Código ${error.code || "BD"}: ${error.message} (Usuario: ${user.email} | ID: ${user.id})`,
        );
        setLoadingAuth(false);
        return;
      }

      if (data) {
        setPerfil(data);
        setLoadingAuth(false);
        return;
      }

      // Si no existe fila en public.perfiles, intentar crearla automáticamente
      const correo = (user.email || "").toLowerCase();
      const rolInferido = correo.includes("vet")
        ? "veterinario"
        : correo.includes("recep")
          ? "recepcionista"
          : "administrador";

      const nombreInferido =
        rolInferido === "veterinario"
          ? "Dr. Carlos Mendoza (Veterinario)"
          : rolInferido === "recepcionista"
            ? "Camila Soto (Recepción)"
            : "Administrador Clínica";

      const { data: creado, error: errorInsert } = await supabase
        .from("perfiles")
        .upsert(
          {
            id: user.id,
            email: user.email,
            nombre_completo: nombreInferido,
            rol: rolInferido,
          },
          { onConflict: "id" },
        )
        .select("*")
        .single();

      if (!activo) return;

      if (errorInsert || !creado) {
        setErrorPerfil(
          `No se encontró ni se pudo crear el perfil (${errorInsert?.code || "sin fila"}: ${
            errorInsert?.message || "verifica tabla perfiles"
          }). ID: ${user.id}`,
        );
      } else {
        setPerfil(creado);
      }
      setLoadingAuth(false);
    };

    obtenerOCrearPerfil();

    return () => {
      activo = false;
    };
  }, [session?.user?.id]);

  // 3. Carga de Datos de la Clínica desde Supabase
  const cargarDatosClinica = async () => {
    if (!supabase) return;

    const [
      resClientes,
      resMascotas,
      resVets,
      resCitas,
      resAtenciones,
      resVacunas,
      resInventario,
      resProveedores,
      resCaja,
    ] = await Promise.all([
      supabase.from("clientes").select("*").order("nombre"),
      supabase
        .from("mascotas")
        .select("*, clientes(nombre, telefono, rut)")
        .order("nombre"),
      supabase
        .from("perfiles")
        .select("*")
        .in("rol", ["veterinario", "administrador"]),
      supabase
        .from("citas")
        .select(
          "*, mascotas(nombre, especie, clientes(nombre, telefono)), perfiles(nombre_completo)",
        )
        .order("fecha_hora", { ascending: true }),
      supabase
        .from("atenciones_clinicas")
        .select("*, perfiles(nombre_completo)")
        .order("created_at", { ascending: false }),
      supabase
        .from("vacunas_control")
        .select("*, mascotas(nombre, clientes(nombre, telefono))")
        .order("proxima_dosis", { ascending: true }),
      supabase
        .from("productos_inventario")
        .select("*, proveedores(nombre)")
        .order("nombre"),
      supabase.from("proveedores").select("*").order("nombre"),
      supabase
        .from("movimientos_caja")
        .select("*")
        .order("fecha", { ascending: false }),
    ]);

    if (resClientes.data) setClientes(resClientes.data);
    if (resMascotas.data) {
      setMascotas(resMascotas.data);
      if (!mascotaSeleccionadaId && resMascotas.data.length > 0) {
        setMascotaSeleccionadaId(resMascotas.data[0].id);
      }
    }
    if (resVets.data) {
      setVeterinarios(resVets.data);
      if (!nuevaCita.veterinario_id && resVets.data.length > 0) {
        setNuevaCita((prev) => ({
          ...prev,
          veterinario_id: resVets.data[0].id,
        }));
      }
    }
    if (resCitas.data) setCitas(resCitas.data);
    if (resAtenciones.data) setAtenciones(resAtenciones.data);
    if (resVacunas.data) setVacunas(resVacunas.data);
    if (resInventario.data) setInventario(resInventario.data);
    if (resProveedores.data) setProveedores(resProveedores.data);
    if (resCaja.data) setMovimientosCaja(resCaja.data);
  };

  useEffect(() => {
    if (perfil) {
      cargarDatosClinica();
    }
  }, [perfil]);

  // 4. Buscador Global Instantáneo (RF-28 / RNF-05)
  const resultadosBusqueda = useMemo(() => {
    const q = busquedaGlobal.trim().toLowerCase();
    if (!q) return [];
    return mascotas.filter(
      (m) =>
        m.nombre.toLowerCase().includes(q) ||
        m.clientes?.nombre?.toLowerCase().includes(q) ||
        m.clientes?.telefono?.includes(q),
    );
  }, [busquedaGlobal, mascotas]);

  const productosStockBajo = useMemo(
    () => inventario.filter((p) => p.stock_actual <= p.stock_minimo),
    [inventario],
  );

  const vacunasProximas = useMemo(() => {
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() + 30);
    return vacunas.filter((v) => new Date(v.proxima_dosis) <= limite);
  }, [vacunas]);

  const generarLinkWhatsApp = (telefono, dueno, mascota, motivo) => {
    const numLimpio = (telefono || "").replace(/\D/g, "");
    const mensaje = `Hola ${dueno}, le escribimos de Clínica Veterinaria Patitas Felices para recordarle ${motivo} de ${mascota}. ¡Le esperamos!`;
    return `https://wa.me/${numLimpio}?text=${encodeURIComponent(mensaje)}`;
  };

  // ============================================================================
  // ACCIONES DE NEGOCIO
  // ============================================================================

  const handleCerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    setSession(null);
    setPerfil(null);
    setErrorPerfil("");
    setActiveTab("dashboard");
  };

  const handleCrearCliente = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("clientes").insert([nuevoCliente]);
    if (error)
      return mostrarMensaje(
        `Error al registrar tutor: ${error.message}`,
        "red",
      );
    setNuevoCliente({
      rut: "",
      nombre: "",
      telefono: "569",
      email: "",
      direccion: "",
    });
    mostrarMensaje("Tutor registrado correctamente.");
    cargarDatosClinica();
  };

  const handleCrearMascota = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from("mascotas")
      .insert([
        { ...nuevaMascota, cliente_id: Number(nuevaMascota.cliente_id) },
      ]);
    if (error)
      return mostrarMensaje(
        `Error al registrar mascota: ${error.message}`,
        "red",
      );
    setNuevaMascota({
      cliente_id: "",
      nombre: "",
      especie: "Perro",
      raza: "",
      sexo: "Macho",
    });
    mostrarMensaje("Mascota vinculada a su ficha clínica digital.");
    cargarDatosClinica();
  };

  const handleAgendarCita = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("citas").insert([
      {
        mascota_id: Number(nuevaCita.mascota_id),
        veterinario_id: nuevaCita.veterinario_id,
        fecha_hora: new Date(nuevaCita.fecha_hora).toISOString(),
        tipo: nuevaCita.tipo,
        estado: "agendada",
      },
    ]);
    if (error) {
      if (error.code === "23505") {
        return mostrarMensaje(
          "Conflicto de horario (RF-12): El veterinario ya tiene una cita en ese bloque.",
          "red",
        );
      }
      return mostrarMensaje(`Error al agendar: ${error.message}`, "red");
    }
    setNuevaCita({ ...nuevaCita, mascota_id: "", fecha_hora: "" });
    mostrarMensaje("Cita agendada con éxito.");
    cargarDatosClinica();
  };

  const cambiarEstadoCita = async (citaId, nuevoEstado) => {
    await supabase
      .from("citas")
      .update({ estado: nuevoEstado })
      .eq("id", citaId);
    cargarDatosClinica();
  };

  const handleGuardarAtencion = async (e) => {
    e.preventDefault();
    if (!mascotaSeleccionadaId) return;

    const { error } = await supabase.from("atenciones_clinicas").insert([
      {
        mascota_id: Number(mascotaSeleccionadaId),
        veterinario_id: perfil.id,
        peso_kg: nuevaAtencion.peso_kg ? Number(nuevaAtencion.peso_kg) : null,
        sintomas: nuevaAtencion.sintomas,
        diagnostico: nuevaAtencion.diagnostico,
        tratamiento: nuevaAtencion.tratamiento,
      },
    ]);

    if (error)
      return mostrarMensaje(
        `Bloqueo de seguridad RLS: ${error.message}`,
        "red",
      );

    if (nuevaAtencion.insumo_id) {
      const { error: stockError } = await supabase.rpc("descontar_inventario", {
        p_producto_id: Number(nuevaAtencion.insumo_id),
        p_cantidad: Number(nuevaAtencion.insumo_cantidad),
      });
      if (stockError) {
        mostrarMensaje(
          `Atención guardada, pero hubo alerta de stock: ${stockError.message}`,
          "amber",
        );
      } else {
        mostrarMensaje(
          "Consulta registrada y stock descontado automáticamente del inventario.",
        );
      }
    } else {
      mostrarMensaje("Consulta médica registrada en la ficha clínica.");
    }

    setNuevaAtencion({
      peso_kg: "",
      sintomas: "",
      diagnostico: "",
      tratamiento: "",
      insumo_id: "",
      insumo_cantidad: 1,
    });
    cargarDatosClinica();
  };

  const handleRegistrarVacuna = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("vacunas_control").insert([
      {
        mascota_id: Number(mascotaSeleccionadaId),
        tipo: nuevaVacuna.tipo,
        nombre_producto: nuevaVacuna.nombre_producto,
        proxima_dosis: nuevaVacuna.proxima_dosis,
      },
    ]);
    if (error) return mostrarMensaje(error.message, "red");
    setNuevaVacuna({ tipo: "vacuna", nombre_producto: "", proxima_dosis: "" });
    mostrarMensaje("Vacuna / Desparasitación programada.");
    cargarDatosClinica();
  };

  const probarBloqueoRLSRecepcion = async () => {
    const { error } = await supabase.from("atenciones_clinicas").insert([
      {
        mascota_id: Number(mascotaSeleccionadaId),
        veterinario_id: perfil.id,
        sintomas: "Intento no autorizado desde recepción",
        diagnostico: "Diagnóstico ilegal",
      },
    ]);
    if (error) {
      mostrarMensaje(
        `RLS ACTIVO (42501): PostgreSQL bloqueó la escritura de diagnóstico porque su rol es "${perfil.rol}".`,
        "amber",
      );
    }
  };

  const handleRegistrarCaja = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("movimientos_caja").insert([
      {
        tipo: nuevoMovimiento.tipo,
        concepto: nuevoMovimiento.concepto,
        monto: Number(nuevoMovimiento.monto),
        metodo_pago: nuevoMovimiento.metodo_pago,
        registrado_por: perfil.id,
      },
    ]);

    if (error) return mostrarMensaje(`Error en caja: ${error.message}`, "red");

    if (
      nuevoMovimiento.tipo === "ingreso" &&
      nuevoMovimiento.producto_venta_id
    ) {
      await supabase.rpc("descontar_inventario", {
        p_producto_id: Number(nuevoMovimiento.producto_venta_id),
        p_cantidad: Number(nuevoMovimiento.cantidad_venta),
      });
    }

    setNuevoMovimiento({
      tipo: "ingreso",
      concepto: "",
      monto: "",
      metodo_pago: "efectivo",
      producto_venta_id: "",
      cantidad_venta: 1,
    });
    mostrarMensaje("Movimiento de caja registrado.");
    cargarDatosClinica();
  };

  const handleAgregarProducto = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("productos_inventario").insert([
      {
        proveedor_id: nuevoProducto.proveedor_id
          ? Number(nuevoProducto.proveedor_id)
          : null,
        nombre: nuevoProducto.nombre,
        categoria: nuevoProducto.categoria,
        stock_actual: Number(nuevoProducto.stock_actual),
        stock_minimo: Number(nuevoProducto.stock_minimo),
        precio_venta: Number(nuevoProducto.precio_venta),
      },
    ]);
    if (error)
      return mostrarMensaje(
        `Solo el Administrador puede crear productos: ${error.message}`,
        "red",
      );
    setNuevoProducto({
      proveedor_id: "",
      nombre: "",
      categoria: "Medicamentos",
      stock_actual: 10,
      stock_minimo: 5,
      precio_venta: "",
    });
    mostrarMensaje("Producto agregado al inventario.");
    cargarDatosClinica();
  };

  const reponerStock = async (prod) => {
    const { error } = await supabase
      .from("productos_inventario")
      .update({ stock_actual: prod.stock_actual + 10 })
      .eq("id", prod.id);
    if (error)
      return mostrarMensaje("Acceso restringido al rol Administrador.", "red");
    mostrarMensaje(`Stock de "${prod.nombre}" incrementado en +10 unidades.`);
    cargarDatosClinica();
  };

  // ============================================================================
  // RENDERIZADO CONDICIONAL
  // ============================================================================
  if (!configValida || !supabase) {
    return (
      <div
        style={{
          padding: "40px",
          fontFamily: "Inter, sans-serif",
          maxWidth: "620px",
          margin: "60px auto",
          background: "#fef3c7",
          border: "1px solid #f59e0b",
          borderRadius: "12px",
          color: "#78350f",
        }}
      >
        <h2 style={{ marginBottom: "10px" }}>
          Falta configurar el archivo .env
        </h2>
        <p style={{ marginBottom: "12px" }}>
          Vite no encontró <code>VITE_SUPABASE_URL</code> o{" "}
          <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <ol style={{ paddingLeft: "20px", lineHeight: 1.7 }}>
          <li>
            Crea el archivo <strong>.env</strong> en la carpeta raíz (junto a{" "}
            <code>package.json</code>).
          </li>
          <li>
            Pega tu URL (<code>https://xxx.supabase.co</code>) y tu clave
            pública <code>anon</code>.
          </li>
          <li>
            Detén la terminal con <strong>Ctrl + C</strong> y vuelve a ejecutar{" "}
            <code>npm run dev</code>.
          </li>
        </ol>
      </div>
    );
  }

  if (loadingAuth) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Conectando con Supabase Auth y verificando políticas RLS...
      </div>
    );
  }

  if (session && errorPerfil) {
    return (
      <div
        style={{
          padding: "32px",
          fontFamily: "Inter, sans-serif",
          maxWidth: "620px",
          margin: "50px auto",
          background: "#fee2e2",
          border: "1px solid #ef4444",
          borderRadius: "12px",
          color: "#7f1d1d",
        }}
      >
        <h3 style={{ marginBottom: "8px" }}>
          Error al leer o crear el perfil en Supabase
        </h3>
        <p style={{ marginBottom: "10px", fontSize: "14px" }}>{errorPerfil}</p>
        <p style={{ marginBottom: "16px", fontSize: "12px", color: "#991b1b" }}>
          Proyecto conectado: <code>{import.meta.env.VITE_SUPABASE_URL}</code>
        </p>
        <button className="btn btn-danger" onClick={handleCerrarSesion}>
          Limpiar Sesión y Volver al Login
        </button>
      </div>
    );
  }

  if (!session || !perfil) {
    return <Login onLoginSuccess={(nuevaSesion) => setSession(nuevaSesion)} />;
  }

  const rol = perfil.rol;
  const mascotaActual = mascotas.find(
    (m) => m.id === Number(mascotaSeleccionadaId),
  );
  const atencionesMascota = atenciones.filter(
    (a) => a.mascota_id === Number(mascotaSeleccionadaId),
  );

  const totalIngresos = movimientosCaja
    .filter((m) => m.tipo === "ingreso")
    .reduce((acc, m) => acc + Number(m.monto), 0);
  const totalGastos = movimientosCaja
    .filter((m) => m.tipo === "gasto")
    .reduce((acc, m) => acc + Number(m.monto), 0);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-icon" style={{ width: 38, height: 38 }}>
            <PawPrint size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px" }}>
              Patitas Felices
            </div>
            <div style={{ fontSize: "11.5px", color: "#94a3b8" }}>
              SaaS Clínico v1.0
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <span className="nav-btn-left">
              <LayoutDashboard size={18} /> Panel General
            </span>
          </button>

          <button
            className={`nav-btn ${activeTab === "agenda" ? "active" : ""}`}
            onClick={() => setActiveTab("agenda")}
          >
            <span className="nav-btn-left">
              <Calendar size={18} /> Agenda y Citas
            </span>
          </button>

          <button
            className={`nav-btn ${activeTab === "clinica" ? "active" : ""}`}
            onClick={() => setActiveTab("clinica")}
          >
            <span className="nav-btn-left">
              <Stethoscope size={18} /> Pacientes y Ficha
            </span>
            {rol === "recepcionista" && <Lock size={14} />}
          </button>

          <button
            className={`nav-btn ${activeTab === "inventario" ? "active" : ""}`}
            onClick={() => setActiveTab("inventario")}
          >
            <span className="nav-btn-left">
              <Package size={18} /> Inventario
            </span>
            {productosStockBajo.length > 0 && (
              <span className="badge badge-amber">
                {productosStockBajo.length}
              </span>
            )}
          </button>

          <button
            className={`nav-btn ${activeTab === "caja" ? "active" : ""} ${
              rol === "veterinario" ? "restricted" : ""
            }`}
            onClick={() => setActiveTab("caja")}
          >
            <span className="nav-btn-left">
              <DollarSign size={18} /> Caja y Finanzas
            </span>
            {rol !== "administrador" && <Lock size={14} />}
          </button>
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: "13px", fontWeight: 600 }}>
            {perfil.nombre_completo}
          </div>
          <div style={{ fontSize: "11.5px", color: "#94a3b8" }}>
            {perfil.email}
          </div>
          <span className="role-pill">{rol}</span>

          <button
            onClick={handleCerrarSesion}
            className="nav-btn"
            style={{ marginTop: "14px", color: "#fca5a5", paddingLeft: 0 }}
          >
            <span className="nav-btn-left">
              <LogOut size={16} /> Cerrar Sesión
            </span>
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="search-container">
            <div className="search-input-wrap">
              <Search size={18} color="#64748b" />
              <input
                type="text"
                className="search-input"
                placeholder="Buscador rápido (<3s): Nombre de mascota, dueño o teléfono..."
                value={busquedaGlobal}
                onChange={(e) => setBusquedaGlobal(e.target.value)}
              />
            </div>

            {resultadosBusqueda.length > 0 && (
              <div className="search-dropdown">
                {resultadosBusqueda.map((m) => (
                  <div key={m.id} className="search-item">
                    <div>
                      <strong>{m.nombre}</strong> ({m.especie}) — Tutor:{" "}
                      <span>{m.clientes?.nombre}</span> ({m.clientes?.telefono})
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setMascotaSeleccionadaId(m.id);
                          setActiveTab("clinica");
                          setBusquedaGlobal("");
                        }}
                      >
                        Abrir Ficha
                      </button>
                      <a
                        href={generarLinkWhatsApp(
                          m.clientes?.telefono,
                          m.clientes?.nombre,
                          m.nombre,
                          "su próximo control clínico",
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-whatsapp"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <span className="badge badge-teal">RLS Activo • Sesión JWT</span>
        </header>

        <main className="page-body">
          {notificacion && (
            <div className={`alert-banner alert-${notificacion.tipo}`}>
              <span>{notificacion.texto}</span>
            </div>
          )}

          {productosStockBajo.length > 0 && (
            <div className="alert-banner alert-amber">
              <span
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <AlertTriangle size={18} />
                <strong>Alerta de Stock Mínimo (RF-20):</strong>{" "}
                {productosStockBajo
                  .map((p) => `${p.nombre} (${p.stock_actual} unid.)`)
                  .join(", ")}
              </span>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setActiveTab("inventario")}
              >
                Ver Inventario
              </button>
            </div>
          )}

          {activeTab === "dashboard" && (
            <div>
              <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>
                Resumen Operativo — Bienvenido/a, {perfil.nombre_completo}
              </h2>

              <div className="kpi-grid">
                <div className="card">
                  <div style={{ color: "#64748b", fontSize: "13px" }}>
                    Pacientes Registrados
                  </div>
                  <div
                    style={{
                      fontSize: "28px",
                      fontWeight: 700,
                      color: "#0d9488",
                    }}
                  >
                    {mascotas.length}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    En {clientes.length} familias registradas
                  </div>
                </div>

                <div className="card">
                  <div style={{ color: "#64748b", fontSize: "13px" }}>
                    Citas Activas / Emergencias
                  </div>
                  <div
                    style={{
                      fontSize: "28px",
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    {
                      citas.filter(
                        (c) =>
                          c.estado !== "atendida" && c.estado !== "cancelada",
                      ).length
                    }
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#ef4444",
                      fontWeight: 600,
                    }}
                  >
                    {
                      citas.filter(
                        (c) =>
                          c.tipo === "emergencia" && c.estado !== "atendida",
                      ).length
                    }{" "}
                    emergencia(s) en curso
                  </div>
                </div>

                <div className="card">
                  <div style={{ color: "#64748b", fontSize: "13px" }}>
                    Vacunas Próximas (30 días)
                  </div>
                  <div
                    style={{
                      fontSize: "28px",
                      fontWeight: 700,
                      color: "#f59e0b",
                    }}
                  >
                    {vacunasProximas.length}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    Listas para recordatorio WhatsApp
                  </div>
                </div>

                <div className="card">
                  <div style={{ color: "#64748b", fontSize: "13px" }}>
                    Balance Caja (Solo Admin)
                  </div>
                  {rol === "administrador" ? (
                    <>
                      <div
                        style={{
                          fontSize: "26px",
                          fontWeight: 700,
                          color: "#0d9488",
                        }}
                      >
                        ${(totalIngresos - totalGastos).toLocaleString("es-CL")}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        Ingresos: ${totalIngresos.toLocaleString("es-CL")}
                      </div>
                    </>
                  ) : (
                    <div style={{ marginTop: "8px" }}>
                      <span className="badge badge-red">
                        <Lock size={12} /> Restringido por RLS (RNF-06)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <Syringe size={18} color="#f59e0b" /> Control Preventivo de
                    Vacunas y Recordatorios WhatsApp (RF-09 / RF-15)
                  </h3>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Mascota</th>
                        <th>Tutor</th>
                        <th>Vacuna / Antiparasitario</th>
                        <th>Próxima Dosis</th>
                        <th>Acción Directa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vacunas.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <strong>{v.mascotas?.nombre}</strong>
                          </td>
                          <td>
                            {v.mascotas?.clientes?.nombre} (
                            {v.mascotas?.clientes?.telefono})
                          </td>
                          <td>{v.nombre_producto}</td>
                          <td>
                            <span className="badge badge-amber">
                              {v.proxima_dosis}
                            </span>
                          </td>
                          <td>
                            <a
                              href={generarLinkWhatsApp(
                                v.mascotas?.clientes?.telefono,
                                v.mascotas?.clientes?.nombre,
                                v.mascotas?.nombre,
                                `la aplicación de ${v.nombre_producto} programada para el ${v.proxima_dosis}`,
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-whatsapp"
                            >
                              <MessageCircle size={14} /> Enviar Recordatorio
                              WhatsApp
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "agenda" && (
            <div className="two-col">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Agendar Cita o Emergencia</h3>
                </div>
                <form onSubmit={handleAgendarCita}>
                  <div className="form-group">
                    <label className="form-label">Paciente (Mascota)</label>
                    <select
                      className="form-control"
                      value={nuevaCita.mascota_id}
                      onChange={(e) =>
                        setNuevaCita({
                          ...nuevaCita,
                          mascota_id: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">Seleccione mascota...</option>
                      {mascotas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre} — Dueño: {m.clientes?.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Veterinario Asignado (RF-11)
                    </label>
                    <select
                      className="form-control"
                      value={nuevaCita.veterinario_id}
                      onChange={(e) =>
                        setNuevaCita({
                          ...nuevaCita,
                          veterinario_id: e.target.value,
                        })
                      }
                      required
                    >
                      {veterinarios.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nombre_completo} ({v.rol})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Fecha y Hora (Bloque único por vet)
                    </label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={nuevaCita.fecha_hora}
                      onChange={(e) =>
                        setNuevaCita({
                          ...nuevaCita,
                          fecha_hora: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Prioridad / Triaje (RF-13)
                    </label>
                    <select
                      className="form-control"
                      value={nuevaCita.tipo}
                      onChange={(e) =>
                        setNuevaCita({ ...nuevaCita, tipo: e.target.value })
                      }
                    >
                      <option value="regular">Cita Regular</option>
                      <option value="emergencia">
                        Emergencia Clínica (Urgente)
                      </option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                  >
                    <Plus size={16} /> Confirmar Agendamiento
                  </button>
                </form>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Calendario de Atenciones</h3>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha / Hora</th>
                        <th>Paciente</th>
                        <th>Prioridad</th>
                        <th>Estado</th>
                        <th>WhatsApp / Gestión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {citas.map((c) => (
                        <tr key={c.id}>
                          <td>
                            {new Date(c.fecha_hora).toLocaleString("es-CL")}
                          </td>
                          <td>
                            <strong>{c.mascotas?.nombre}</strong>
                            <div style={{ fontSize: "12px", color: "#64748b" }}>
                              Tutor: {c.mascotas?.clientes?.nombre}
                            </div>
                          </td>
                          <td>
                            {c.tipo === "emergencia" ? (
                              <span className="badge badge-red">
                                EMERGENCIA
                              </span>
                            ) : (
                              <span className="badge badge-teal">Regular</span>
                            )}
                          </td>
                          <td>
                            <select
                              className="form-control"
                              style={{ padding: "4px 8px", fontSize: "12.5px" }}
                              value={c.estado}
                              onChange={(e) =>
                                cambiarEstadoCita(c.id, e.target.value)
                              }
                            >
                              <option value="agendada">Agendada</option>
                              <option value="en_espera">En espera</option>
                              <option value="atendida">Atendida</option>
                              <option value="cancelada">Cancelada</option>
                            </select>
                          </td>
                          <td>
                            <a
                              href={generarLinkWhatsApp(
                                c.mascotas?.clientes?.telefono,
                                c.mascotas?.clientes?.nombre,
                                c.mascotas?.nombre,
                                `su cita médica agendada para el ${new Date(
                                  c.fecha_hora,
                                ).toLocaleString("es-CL")}`,
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-whatsapp"
                            >
                              <MessageCircle size={14} /> Avisar
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "clinica" && (
            <div className="two-col">
              <div>
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">1. Registrar Tutor (RF-01)</h3>
                  </div>
                  <form onSubmit={handleCrearCliente}>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">RUT</label>
                        <input
                          className="form-control"
                          placeholder="12.345.678-9"
                          value={nuevoCliente.rut}
                          onChange={(e) =>
                            setNuevoCliente({
                              ...nuevoCliente,
                              rut: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Teléfono WhatsApp</label>
                        <input
                          className="form-control"
                          placeholder="56912345678"
                          value={nuevoCliente.telefono}
                          onChange={(e) =>
                            setNuevoCliente({
                              ...nuevoCliente,
                              telefono: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nombre Completo</label>
                      <input
                        className="form-control"
                        value={nuevoCliente.nombre}
                        onChange={(e) =>
                          setNuevoCliente({
                            ...nuevoCliente,
                            nombre: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ width: "100%" }}
                    >
                      Guardar Tutor
                    </button>
                  </form>
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">
                      2. Registrar Mascota (RF-02 / RF-03)
                    </h3>
                  </div>
                  <form onSubmit={handleCrearMascota}>
                    <div className="form-group">
                      <label className="form-label">Dueño / Tutor</label>
                      <select
                        className="form-control"
                        value={nuevaMascota.cliente_id}
                        onChange={(e) =>
                          setNuevaMascota({
                            ...nuevaMascota,
                            cliente_id: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Seleccione tutor...</option>
                        {clientes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} ({c.rut})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Nombre Mascota</label>
                        <input
                          className="form-control"
                          value={nuevaMascota.nombre}
                          onChange={(e) =>
                            setNuevaMascota({
                              ...nuevaMascota,
                              nombre: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Especie</label>
                        <select
                          className="form-control"
                          value={nuevaMascota.especie}
                          onChange={(e) =>
                            setNuevaMascota({
                              ...nuevaMascota,
                              especie: e.target.value,
                            })
                          }
                        >
                          <option value="Perro">Perro</option>
                          <option value="Gato">Gato</option>
                          <option value="Exótico">Exótico</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Raza</label>
                      <input
                        className="form-control"
                        value={nuevaMascota.raza}
                        onChange={(e) =>
                          setNuevaMascota({
                            ...nuevaMascota,
                            raza: e.target.value,
                          })
                        }
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ width: "100%" }}
                    >
                      Crear Ficha de Mascota
                    </button>
                  </form>
                </div>
              </div>

              <div>
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">
                      Ficha Clínica Electrónica (RF-04)
                    </h3>
                    <select
                      className="form-control"
                      style={{ maxWidth: "280px" }}
                      value={mascotaSeleccionadaId || ""}
                      onChange={(e) => setMascotaSeleccionadaId(e.target.value)}
                    >
                      {mascotas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre} ({m.especie}) — {m.clientes?.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  {mascotaActual && (
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px",
                        borderRadius: "8px",
                        marginBottom: "16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong>{mascotaActual.nombre}</strong> •{" "}
                        {mascotaActual.especie} (
                        {mascotaActual.raza || "Mestizo"})
                        <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                          Tutor: {mascotaActual.clientes?.nombre} | Tel:{" "}
                          {mascotaActual.clientes?.telefono}
                        </div>
                      </div>
                      <a
                        href={generarLinkWhatsApp(
                          mascotaActual.clientes?.telefono,
                          mascotaActual.clientes?.nombre,
                          mascotaActual.nombre,
                          "la revisión de su ficha clínica",
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-whatsapp"
                      >
                        <MessageCircle size={14} /> Contactar Tutor
                      </a>
                    </div>
                  )}

                  {rol === "recepcionista" ? (
                    <div className="alert-banner alert-red">
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <ShieldAlert size={18} />
                        <strong>Restricción RF-31:</strong> El rol Recepcionista
                        tiene bloqueada la creación o modificación de
                        diagnósticos clínicos.
                      </span>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={probarBloqueoRLSRecepcion}
                      >
                        Probar Bloqueo RLS en BD
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleGuardarAtencion}
                      style={{ marginBottom: "20px" }}
                    >
                      <h4
                        style={{
                          fontSize: "14px",
                          marginBottom: "10px",
                          color: "#0d9488",
                        }}
                      >
                        Registrar Nueva Consulta Médica + Descuento de Insumos
                        (RF-06 / RF-17)
                      </h4>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Peso (kg)</label>
                          <input
                            type="number"
                            step="0.1"
                            className="form-control"
                            value={nuevaAtencion.peso_kg}
                            onChange={(e) =>
                              setNuevaAtencion({
                                ...nuevaAtencion,
                                peso_kg: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Síntomas</label>
                          <input
                            className="form-control"
                            value={nuevaAtencion.sintomas}
                            onChange={(e) =>
                              setNuevaAtencion({
                                ...nuevaAtencion,
                                sintomas: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Diagnóstico Médico</label>
                        <input
                          className="form-control"
                          value={nuevaAtencion.diagnostico}
                          onChange={(e) =>
                            setNuevaAtencion({
                              ...nuevaAtencion,
                              diagnostico: e.target.value,
                            })
                          }
                          required
                        />
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">
                            Insumo/Medicamento Utilizado (Descuenta Stock)
                          </label>
                          <select
                            className="form-control"
                            value={nuevaAtencion.insumo_id}
                            onChange={(e) =>
                              setNuevaAtencion({
                                ...nuevaAtencion,
                                insumo_id: e.target.value,
                              })
                            }
                          >
                            <option value="">Ninguno / Solo consulta</option>
                            {inventario.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre} (Stock: {p.stock_actual})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Cantidad Usada</label>
                          <input
                            type="number"
                            min="1"
                            className="form-control"
                            value={nuevaAtencion.insumo_cantidad}
                            onChange={(e) =>
                              setNuevaAtencion({
                                ...nuevaAtencion,
                                insumo_cantidad: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      <button type="submit" className="btn btn-primary">
                        <Check size={16} /> Guardar Consulta y Actualizar Stock
                      </button>
                    </form>
                  )}

                  <h4 style={{ fontSize: "14px", marginBottom: "8px" }}>
                    Historial de Atenciones ({atencionesMascota.length})
                  </h4>
                  <div className="table-wrap" style={{ marginBottom: "18px" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Diagnóstico</th>
                          <th>Síntomas</th>
                          <th>Veterinario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atencionesMascota.length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{ color: "#64748b" }}>
                              Sin consultas previas registradas.
                            </td>
                          </tr>
                        ) : (
                          atencionesMascota.map((a) => (
                            <tr key={a.id}>
                              <td>
                                {new Date(a.created_at).toLocaleDateString(
                                  "es-CL",
                                )}
                              </td>
                              <td>
                                <strong>{a.diagnostico}</strong>
                              </td>
                              <td>{a.sintomas}</td>
                              <td>{a.perfiles?.nombre_completo}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {rol !== "recepcionista" && (
                    <form onSubmit={handleRegistrarVacuna}>
                      <h4 style={{ fontSize: "14px", marginBottom: "8px" }}>
                        Programar Vacuna o Desparasitación (RF-07 / RF-08)
                      </h4>
                      <div className="form-row">
                        <div className="form-group">
                          <input
                            className="form-control"
                            placeholder="Ej: Vacuna Óctuple / Antiparasitario"
                            value={nuevaVacuna.nombre_producto}
                            onChange={(e) =>
                              setNuevaVacuna({
                                ...nuevaVacuna,
                                nombre_producto: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div
                          className="form-group"
                          style={{ display: "flex", gap: "8px" }}
                        >
                          <input
                            type="date"
                            className="form-control"
                            value={nuevaVacuna.proxima_dosis}
                            onChange={(e) =>
                              setNuevaVacuna({
                                ...nuevaVacuna,
                                proxima_dosis: e.target.value,
                              })
                            }
                            required
                          />
                          <button type="submit" className="btn btn-primary">
                            Programar
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "inventario" && (
            <div className="two-col">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Agregar Medicamento / Insumo</h3>
                </div>
                {rol !== "administrador" ? (
                  <div className="alert-banner alert-amber">
                    Solo el rol Administrador puede crear nuevos ítems o reponer
                    compras (RF-21).
                  </div>
                ) : (
                  <form onSubmit={handleAgregarProducto}>
                    <div className="form-group">
                      <label className="form-label">Nombre Producto</label>
                      <input
                        className="form-control"
                        value={nuevoProducto.nombre}
                        onChange={(e) =>
                          setNuevoProducto({
                            ...nuevoProducto,
                            nombre: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Proveedor (RF-22)</label>
                      <select
                        className="form-control"
                        value={nuevoProducto.proveedor_id}
                        onChange={(e) =>
                          setNuevoProducto({
                            ...nuevoProducto,
                            proveedor_id: e.target.value,
                          })
                        }
                      >
                        <option value="">Seleccione proveedor...</option>
                        {proveedores.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            {pr.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Stock Inicial</label>
                        <input
                          type="number"
                          className="form-control"
                          value={nuevoProducto.stock_actual}
                          onChange={(e) =>
                            setNuevoProducto({
                              ...nuevoProducto,
                              stock_actual: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">
                          Stock Mínimo Alerta
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          value={nuevoProducto.stock_minimo}
                          onChange={(e) =>
                            setNuevoProducto({
                              ...nuevoProducto,
                              stock_minimo: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Precio Venta ($ CLP)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={nuevoProducto.precio_venta}
                        onChange={(e) =>
                          setNuevoProducto({
                            ...nuevoProducto,
                            precio_venta: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ width: "100%" }}
                    >
                      Registrar en Catálogo
                    </button>
                  </form>
                )}
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    Control de Stock en Tiempo Real
                  </h3>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Proveedor</th>
                        <th>Stock Actual</th>
                        <th>Estado</th>
                        {rol === "administrador" && <th>Reposición</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {inventario.map((p) => {
                        const bajo = p.stock_actual <= p.stock_minimo;
                        return (
                          <tr key={p.id}>
                            <td>
                              <strong>{p.nombre}</strong>
                              <div
                                style={{ fontSize: "12px", color: "#64748b" }}
                              >
                                $
                                {Number(p.precio_venta).toLocaleString("es-CL")}
                              </div>
                            </td>
                            <td>{p.proveedores?.nombre || "General"}</td>
                            <td>
                              <strong>{p.stock_actual}</strong> / mín.{" "}
                              {p.stock_minimo}
                            </td>
                            <td>
                              {bajo ? (
                                <span className="badge badge-amber">
                                  STOCK BAJO
                                </span>
                              ) : (
                                <span className="badge badge-teal">Óptimo</span>
                              )}
                            </td>
                            {rol === "administrador" && (
                              <td>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => reponerStock(p)}
                                >
                                  +10 Compra
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "caja" && (
            <div className="two-col">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Registrar Pago o Venta en Caja</h3>
                </div>
                {rol === "veterinario" ? (
                  <div className="alert-banner alert-amber">
                    El módulo de recaudación es operado por Recepción y
                    Administración.
                  </div>
                ) : (
                  <form onSubmit={handleRegistrarCaja}>
                    <div className="form-group">
                      <label className="form-label">Tipo de Movimiento</label>
                      <select
                        className="form-control"
                        value={nuevoMovimiento.tipo}
                        onChange={(e) =>
                          setNuevoMovimiento({
                            ...nuevoMovimiento,
                            tipo: e.target.value,
                          })
                        }
                      >
                        <option value="ingreso">
                          Ingreso (Consulta o Venta)
                        </option>
                        {rol === "administrador" && (
                          <option value="gasto">
                            Gasto Operativo / Proveedor
                          </option>
                        )}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Concepto</label>
                      <input
                        className="form-control"
                        placeholder="Ej: Consulta médica + Antiparasitario"
                        value={nuevoMovimiento.concepto}
                        onChange={(e) =>
                          setNuevoMovimiento({
                            ...nuevoMovimiento,
                            concepto: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    {nuevoMovimiento.tipo === "ingreso" && (
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">
                            Producto Vendido (Opcional - Descuenta Stock RF-18)
                          </label>
                          <select
                            className="form-control"
                            value={nuevoMovimiento.producto_venta_id}
                            onChange={(e) =>
                              setNuevoMovimiento({
                                ...nuevoMovimiento,
                                producto_venta_id: e.target.value,
                              })
                            }
                          >
                            <option value="">Solo servicio clínico</option>
                            {inventario.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre} (${p.precio_venta})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Cantidad</label>
                          <input
                            type="number"
                            min="1"
                            className="form-control"
                            value={nuevoMovimiento.cantidad_venta}
                            onChange={(e) =>
                              setNuevoMovimiento({
                                ...nuevoMovimiento,
                                cantidad_venta: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    )}

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Monto ($ CLP)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={nuevoMovimiento.monto}
                          onChange={(e) =>
                            setNuevoMovimiento({
                              ...nuevoMovimiento,
                              monto: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">
                          Método de Pago (RF-24)
                        </label>
                        <select
                          className="form-control"
                          value={nuevoMovimiento.metodo_pago}
                          onChange={(e) =>
                            setNuevoMovimiento({
                              ...nuevoMovimiento,
                              metodo_pago: e.target.value,
                            })
                          }
                        >
                          <option value="efectivo">Efectivo</option>
                          <option value="tarjeta">
                            Tarjeta Débito/Crédito
                          </option>
                          <option value="transferencia">Transferencia</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ width: "100%" }}
                    >
                      Registrar en Caja
                    </button>
                  </form>
                )}
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    Flujo de Caja e Historial Financiero
                  </h3>
                </div>

                {rol !== "administrador" ? (
                  <div className="alert-banner alert-red">
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <Lock size={18} />
                      <strong>Seguridad RNF-06 (RLS):</strong> Los reportes
                      financieros y totales de caja solo son visibles para el
                      rol Administrador.
                    </span>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        marginBottom: "16px",
                        padding: "12px",
                        background: "#f8fafc",
                        borderRadius: "8px",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          Ingresos Totales
                        </span>
                        <div style={{ fontWeight: 700, color: "#0d9488" }}>
                          +${totalIngresos.toLocaleString("es-CL")}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          Gastos Totales
                        </span>
                        <div style={{ fontWeight: 700, color: "#ef4444" }}>
                          -${totalGastos.toLocaleString("es-CL")}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          Flujo Neto
                        </span>
                        <div style={{ fontWeight: 700 }}>
                          $
                          {(totalIngresos - totalGastos).toLocaleString(
                            "es-CL",
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Concepto</th>
                            <th>Medio</th>
                            <th>Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movimientosCaja.map((mov) => (
                            <tr key={mov.id}>
                              <td>
                                {new Date(mov.fecha).toLocaleDateString(
                                  "es-CL",
                                )}
                              </td>
                              <td>
                                {mov.tipo === "ingreso" ? (
                                  <span className="badge badge-teal">
                                    Ingreso
                                  </span>
                                ) : (
                                  <span className="badge badge-red">Gasto</span>
                                )}
                              </td>
                              <td>{mov.concepto}</td>
                              <td style={{ textTransform: "capitalize" }}>
                                {mov.metodo_pago}
                              </td>
                              <td>
                                <strong>
                                  ${Number(mov.monto).toLocaleString("es-CL")}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
