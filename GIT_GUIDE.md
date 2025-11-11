# 📦 Guía para Subir a GitHub

## Paso 1: Preparar el Repositorio Local

```powershell
# Navega a la raíz del proyecto
cd c:\Users\HP\Desktop\basura\ivan\BoutiqueCruz_Backend

# Inicializar Git (si no está inicializado)
git init

# Agregar archivos al staging
git add .

# Ver el estado
git status

# Hacer commit inicial
git commit -m "Initial commit: Backend Django + Frontend React con ML y Reportes"
```

## Paso 2: Crear Repositorio en GitHub

1. Ve a https://github.com
2. Click en **"New repository"** (+)
3. Nombre: `BoutiqueCruz_Backend` (o el nombre que prefieras)
4. Descripción: `Sistema de gestión e-commerce con ML para Boutique Cruz`
5. Selecciona **Private** o **Public**
6. **NO** marques "Initialize with README" (ya tienes uno)
7. Click en **"Create repository"**

## Paso 3: Conectar y Subir

```powershell
# Agregar remote (reemplaza TU_USUARIO con tu username de GitHub)
git remote add origin https://github.com/IvanSuarezR/BoutiqueCruz_Backend.git

# Verificar remote
git remote -v

# Subir a GitHub
git push -u origin main

# Si el branch se llama "master", usa:
git push -u origin master
```

## Paso 4: Verificar

Abre tu repositorio en GitHub y verifica que todos los archivos se hayan subido correctamente.

---

## 🔄 Comandos para Actualizaciones Futuras

```powershell
# Ver cambios
git status

# Agregar cambios
git add .

# Commit con mensaje descriptivo
git commit -m "Descripción de los cambios"

# Subir a GitHub
git push origin main
```

---

## 📝 Buenas Prácticas

### Mensajes de Commit
```bash
# Formato recomendado
git commit -m "feat: agregar endpoint de reportes con IA"
git commit -m "fix: corregir error de tipos Decimal/float en ML"
git commit -m "docs: actualizar README con instrucciones"
git commit -m "refactor: optimizar servicio de predicciones"
```

### Branches
```bash
# Crear branch para nueva feature
git checkout -b feature/nueva-funcionalidad

# Trabajar en la feature
git add .
git commit -m "feat: implementar nueva funcionalidad"

# Cambiar a main
git checkout main

# Merge la feature
git merge feature/nueva-funcionalidad

# Push
git push origin main
```

---

## ⚠️ IMPORTANTE - Archivos que NO se deben subir

Los siguientes archivos ya están en `.gitignore`:

### Backend
- `venv/` - Entorno virtual
- `.env` - Variables de entorno (¡NUNCA subir!)
- `db.sqlite3` - Base de datos local
- `__pycache__/` - Cache de Python
- `*.pyc` - Archivos compilados
- `media/` - Archivos subidos por usuarios
- `ml_predictions/ml_models/*.pkl` - Modelos entrenados

### Frontend
- `node_modules/` - Dependencias de npm
- `dist/` - Build de producción
- `.env` - Variables de entorno

### Si Accidentalmente Subiste Algo Sensible

```powershell
# Eliminar archivo del repositorio (pero mantenerlo local)
git rm --cached .env

# Commit y push
git commit -m "Remove sensitive file"
git push origin main

# Asegúrate de que esté en .gitignore
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Update .gitignore"
git push origin main
```

---

## 🔐 Configurar SSH (Opcional, Recomendado)

En lugar de usar HTTPS, puedes usar SSH para no ingresar usuario/contraseña cada vez:

```powershell
# Generar clave SSH
ssh-keygen -t ed25519 -C "tu_email@example.com"

# Copiar clave pública
cat ~/.ssh/id_ed25519.pub

# Agregar la clave en GitHub:
# Settings → SSH and GPG keys → New SSH key
```

Luego cambia el remote:
```powershell
git remote set-url origin git@github.com:IvanSuarezR/BoutiqueCruz_Backend.git
```

---

## 📊 Verificar Historial

```powershell
# Ver commits
git log --oneline

# Ver cambios de un archivo
git log -p Backend_Boutique/ml_predictions/services/sales_forecast.py

# Ver quién cambió qué
git blame Backend_Boutique/manage.py
```

---

## 🆘 Comandos de Emergencia

### Deshacer último commit (mantener cambios)
```powershell
git reset --soft HEAD~1
```

### Deshacer último commit (eliminar cambios)
```powershell
git reset --hard HEAD~1
```

### Volver a un commit específico
```powershell
git log --oneline  # Ver commits
git reset --hard abc123  # Reemplaza abc123 con el hash del commit
```

### Descartar cambios locales
```powershell
git restore .
```

---

**¡Listo! Tu proyecto ya está en GitHub 🎉**
