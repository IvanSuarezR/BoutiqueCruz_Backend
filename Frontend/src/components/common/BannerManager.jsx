import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import GCSGalleryModal from '../inventory/GCSGalleryModal.jsx';
import inventoryService from '../../services/inventoryService.js';
import toast from 'react-hot-toast';

const BannerManager = ({ currentBannerUrl, onBannerUpdate }) => {
  const { canAccessPanel } = useAuth();
  const [showGallery, setShowGallery] = useState(false);
  const [loading, setLoading] = useState(false);

  // Solo mostrar si el usuario tiene acceso al panel (admin, dueño, etc.)
  if (!canAccessPanel()) {
    return null;
  }

  const handleSelectBanner = async (gcsImages) => {
    if (gcsImages.length === 0) return;
    
    // Tomar la primera imagen seleccionada
    const selectedImage = gcsImages[0];
    
    setLoading(true);
    try {
      // Actualizar el banner en el backend
      const response = await inventoryService.updateBanner(selectedImage.url);
      setShowGallery(false);
      
      toast.success('Banner actualizado correctamente');
      
      // Llamar callback para actualizar el banner en el componente padre
      if (onBannerUpdate) {
        onBannerUpdate(selectedImage.url);
      }
      
      // Recargar la página para ver los cambios (opcional)
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('No tienes permiso para modificar el banner');
      } else {
        toast.error('Error al actualizar el banner');
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón de editar sobre el banner */}
      <button
        onClick={() => setShowGallery(true)}
        disabled={loading}
        className="absolute top-4 right-4 w-10 h-10 bg-white/90 hover:bg-white backdrop-blur-sm text-gray-700 hover:text-gray-900 rounded-lg shadow-lg flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed group z-10"
        title="Editar banner (Solo administradores)"
      >
        {loading ? (
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        )}
      </button>

      {showGallery && (
        <GCSGalleryModal
          onClose={() => setShowGallery(false)}
          onSelectImage={handleSelectBanner}
        />
      )}
    </>
  );
};

export default BannerManager;
