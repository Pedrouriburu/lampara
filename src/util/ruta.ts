// Navegación por el hash de la dirección (#riesgo, #acciones, #cartera, #historial, #supuestos).
import { useEffect, useState } from 'react'

export type Ruta = 'riesgo' | 'acciones' | 'cartera' | 'historial' | 'supuestos'
export const RUTAS: Ruta[] = ['riesgo', 'acciones', 'cartera', 'historial', 'supuestos']

function leer(): Ruta {
  const h = window.location.hash.replace(/^#/, '')
  return (RUTAS as string[]).includes(h) ? (h as Ruta) : 'riesgo'
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(leer)
  useEffect(() => {
    const alCambiar = () => {
      setRuta(leer())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])
  return ruta
}

export type Tema = 'auto' | 'light' | 'dark'

export function leerTema(): Tema {
  try {
    const t = localStorage.getItem('lampara-tema')
    return t === 'light' || t === 'dark' ? t : 'auto'
  } catch {
    return 'auto'
  }
}

export function aplicarTema(t: Tema) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', t)
  try {
    if (t === 'auto') localStorage.removeItem('lampara-tema')
    else localStorage.setItem('lampara-tema', t)
  } catch {
    /* sin almacenamiento: el tema dura lo que dure la pestaña */
  }
}
