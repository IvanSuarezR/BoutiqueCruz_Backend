import { useState, useEffect } from 'react';
import inventoryService from '../../services/inventoryService.js';
import toast from 'react-hot-toast';

const GCSGalleryModal = ({ onClose, onSelectImage }) => {
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' o 'list'
  const [filterFolder, setFilterFolder] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  const loadImages = async () => {
    try {
      setLoading(true);
      const data = await inventoryService.getGCSImages();
      setImages(data.images || []);
    } catch (err) {
      toast.error('Error al cargar imágenes del bucket');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, []);

  // Extraer carpetas únicas de las imágenes
  const folders = ['all', ...new Set(
    images
      .map(img => img.name.split('/')[0])
      .filter(f => f)
  )];

  // Filtrar imágenes
  const filteredImages = images.filter(img => {
    // Filtrar por carpeta
    if (filterFolder !== 'all' && !img.name.startsWith(filterFolder + '/')) {
      return false;
    }
    // Filtrar por búsqueda
    if (searchQuery && !img.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    try {
      setUploading(true);
      const folder = filterFolder === 'all' ? 'gallery' : filterFolder;
      await inventoryService.uploadToGCS(files, folder);
      toast.success(`${files.length} imagen(es) subida(s) correctamente`);
      await loadImages();
    } catch (err) {
      toast.error('Error al subir imágenes');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imagePath) => {
    if (!window.confirm(`¿Eliminar ${imagePath}?`)) return;
    
    try {
      await inventoryService.deleteFromGCS(imagePath);
      toast.success('Imagen eliminada');
      setImages(prev => prev.filter(img => img.name !== imagePath));
      setSelectedImages(prev => prev.filter(path => path !== imagePath));
    } catch (err) {
      toast.error('Error al eliminar imagen');
      console.error(err);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast.error('Ingresa un nombre para la carpeta');
      return;
    }
    
    try {
      await inventoryService.createGCSFolder(folderName.trim());
      toast.success(`Carpeta "${folderName}" creada`);
      setFolderName('');
      setShowCreateFolder(false);
      await loadImages();
    } catch (err) {
      toast.error('Error al crear carpeta');
      console.error(err);
    }
  };

  const toggleSelectImage = (imagePath) => {
    setSelectedImages(prev => 
      prev.includes(imagePath) 
        ? prev.filter(p => p !== imagePath)
        : [...prev, imagePath]
    );
  };

  const handleSelectForProduct = () => {
    if (selectedImages.length === 0) {
      toast.error('Selecciona al menos una imagen');
      return;
    }
    
    // Convertir paths a objetos con URL completa
    const selectedImagesData = images.filter(img => selectedImages.includes(img.name));
    onSelectImage && onSelectImage(selectedImagesData);
    onClose && onClose();
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-900">Gestor de Galería</h3>
              <p className="text-sm text-gray-500">Google Cloud Storage</p>
            </div>
            {selectedImages.length > 0 && (
              <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                {selectedImages.length} seleccionada{selectedImages.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="btn-outline-slim text-sm cursor-pointer hover:bg-gray-100 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {uploading ? 'Subiendo...' : 'Subir'}
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleUpload(Array.from(e.target.files || []))}
              />
            </label>
            <button 
              className="btn-outline-slim text-sm hover:bg-gray-100 transition-colors flex items-center gap-2" 
              onClick={() => setShowCreateFolder(!showCreateFolder)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Nueva Carpeta
            </button>
            <button 
              className="btn-outline-slim text-sm hover:bg-gray-100 transition-colors flex items-center gap-2" 
              onClick={loadImages}
              disabled={loading}
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? 'Cargando...' : 'Refrescar'}
            </button>
            <button className="btn-outline-slim text-sm hover:bg-gray-100 transition-colors" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        {/* Crear carpeta */}
        {showCreateFolder && (
          <div className="border-b px-6 py-3 bg-amber-50 flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <input
              type="text"
              placeholder="Nombre de la nueva carpeta"
              className="border rounded-lg px-3 py-2 text-sm flex-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
            />
            <button className="btn btn-primary text-sm px-4" onClick={handleCreateFolder}>
              Crear
            </button>
            <button 
              className="btn-outline-slim text-sm" 
              onClick={() => setShowCreateFolder(false)}
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="border-b px-6 py-3 flex items-center gap-3 bg-gray-50">
          <div className="flex items-center gap-2 flex-1">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <select 
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filterFolder}
              onChange={(e) => setFilterFolder(e.target.value)}
            >
              {folders.map(folder => (
                <option key={folder} value={folder}>
                  {folder === 'all' ? 'Todas las carpetas' : folder}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2 flex-1 relative">
            <svg className="w-5 h-5 text-gray-400 absolute left-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre..."
              className="border rounded-lg pl-10 pr-3 py-2 text-sm flex-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-0 border rounded-lg overflow-hidden">
            <button
              className={`px-4 py-2 text-sm flex items-center gap-2 transition-colors ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setViewMode('grid')}
              title="Vista de cuadrícula"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Cuadrícula
            </button>
            <button
              className={`px-4 py-2 text-sm flex items-center gap-2 transition-colors ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setViewMode('list')}
              title="Vista de lista"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Lista
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {loading ? (
            <div className="text-center text-gray-500 py-12">
              <svg className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Cargando imágenes...
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>No hay imágenes{searchQuery && ' que coincidan con la búsqueda'}</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredImages.map((img) => (
                <div
                  key={img.name}
                  className={`group relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all bg-white hover:shadow-lg ${
                    selectedImages.includes(img.name) 
                      ? 'ring-2 ring-blue-500 border-blue-500 shadow-md' 
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => toggleSelectImage(img.name)}
                >
                  <div className="aspect-square bg-gray-100 overflow-hidden relative">
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/150?text=Error+Carga';
                        console.error('Error loading image:', img.url);
                      }}
                    />
                    {selectedImages.includes(img.name) && (
                      <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-white">
                    <div className="text-xs font-medium text-gray-900 truncate" title={img.name}>
                      {img.name.split('/').pop()}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">{formatSize(img.size)}</div>
                  </div>
                  <button
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(img.name);
                    }}
                    title="Eliminar imagen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredImages.map((img) => (
                <div
                  key={img.name}
                  className={`flex items-center gap-4 p-3 border-2 rounded-lg cursor-pointer transition-all bg-white hover:shadow-md ${
                    selectedImages.includes(img.name) ? 'bg-blue-50 border-blue-500 shadow-sm' : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => toggleSelectImage(img.name)}
                >
                  {selectedImages.includes(img.name) && (
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{img.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatSize(img.size)} • {img.content_type}
                    </div>
                  </div>
                  <button
                    className="btn-outline-slim text-sm text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(img.name);
                    }}
                    title="Eliminar imagen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="text-sm text-gray-700 font-medium">
              {filteredImages.length} imagen{filteredImages.length !== 1 ? 'es' : ''}</div>
            {selectedImages.length > 0 && (
              <>
                <div className="w-px h-4 bg-gray-300"></div>
                <div className="text-sm text-blue-600 font-medium">
                  {selectedImages.length} seleccionada{selectedImages.length !== 1 ? 's' : ''}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-outline-slim text-sm hover:bg-gray-100 transition-colors" onClick={onClose}>
              Cancelar
            </button>
            {onSelectImage && (
              <button 
                className="btn btn-primary text-sm px-6 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleSelectForProduct}
                disabled={selectedImages.length === 0}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Usar {selectedImages.length > 0 ? `(${selectedImages.length})` : 'seleccionadas'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GCSGalleryModal;
