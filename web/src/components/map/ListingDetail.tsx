'use client'

import type { Listing } from '@/types/listing'

interface Props {
  listing: Listing | null
  onClose: () => void
}

export function ListingDetail({ listing, onClose }: Props) {
  if (!listing) return null

  return (
    <div className="absolute bottom-4 left-[376px] z-50 w-[380px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{listing.atclNm}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {listing.cityName} {listing.districtName} | {listing.propertyType}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">거래유형</p>
            <p className="text-sm font-semibold mt-0.5">{listing.tradeType}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">가격</p>
            <p className="text-sm font-semibold mt-0.5 text-blue-600">
              {listing.priceDisplay}
              {listing.rentPrice != null && listing.rentPrice > 0 && (
                <span className="text-gray-500">/{listing.rentPrice}만</span>
              )}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">면적</p>
            <p className="text-sm font-semibold mt-0.5">
              {listing.pyeong.toFixed(1)}평
              <span className="text-xs text-gray-400 ml-1">({listing.exclusiveArea}㎡)</span>
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">층</p>
            <p className="text-sm font-semibold mt-0.5">{listing.floorInfo || '-'}</p>
          </div>
        </div>

        {listing.tags && listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {listing.tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <a
            href={listing.naverUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 bg-green-600 text-white text-center text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            네이버에서 보기
          </a>
        </div>

        <p className="text-[11px] text-gray-400 mt-2 text-right">
          확인일: {listing.confirmDate
            ? `20${listing.confirmDate.slice(2, 4)}.${listing.confirmDate.slice(4, 6)}.${listing.confirmDate.slice(6, 8)}`
            : '-'
          }
        </p>
      </div>
    </div>
  )
}
