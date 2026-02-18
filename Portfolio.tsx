import { Trade } from '../types';
import { calculatePositions, formatCurrency, formatNumber } from '../utils/helpers';
import { Briefcase, TrendingUp, TrendingDown } from 'lucide-react';

interface PortfolioProps {
  trades: Trade[];
}

export function Portfolio({ trades }: PortfolioProps) {
  const positions = calculatePositions(trades);
  const activePositions = positions.filter(p => p.holdingQuantity > 0);
  const closedPositions = positions.filter(p => p.holdingQuantity === 0 && p.sellQuantity > 0);

  const totalInvested = activePositions.reduce(
    (sum, p) => sum + p.avgBuyPrice * p.holdingQuantity,
    0
  );

  const totalRealizedPnL = positions.reduce((sum, p) => sum + p.realizedPnL, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <Briefcase className="w-5 h-5 text-indigo-600" />
            </div>
            <span className="text-sm text-gray-500">보유 종목 수</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{activePositions.length}개</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-xl">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-gray-500">총 투자 금액</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalInvested)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-xl ${totalRealizedPnL >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              {totalRealizedPnL >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
            <span className="text-sm text-gray-500">총 실현 손익</span>
          </div>
          <p className={`text-2xl font-bold ${totalRealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalRealizedPnL >= 0 ? '+' : ''}{formatCurrency(totalRealizedPnL)}
          </p>
        </div>
      </div>

      {/* Active Positions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            💼 보유 종목
            <span className="text-sm font-normal text-gray-400">({activePositions.length}개)</span>
          </h3>
        </div>
        {activePositions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <p>현재 보유 중인 종목이 없습니다</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">종목</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">보유수량</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">평균매수가</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">투자금액</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">매수횟수</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">매도횟수</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activePositions.map(pos => {
                    const investedAmount = pos.avgBuyPrice * pos.holdingQuantity;
                    return (
                      <tr key={pos.stockCode || pos.stockName} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <p className="font-bold text-gray-800">{pos.stockName}</p>
                          {pos.stockCode && <p className="text-xs text-gray-400">{pos.stockCode}</p>}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-semibold text-gray-800">{formatNumber(pos.holdingQuantity)}주</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-semibold text-gray-800">{formatNumber(Math.round(pos.avgBuyPrice))}원</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-semibold text-gray-800">{formatCurrency(Math.round(investedAmount))}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm text-red-500 font-semibold">{pos.buyQuantity > 0 ? `${formatNumber(pos.buyQuantity)}주` : '-'}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm text-blue-500 font-semibold">{pos.sellQuantity > 0 ? `${formatNumber(pos.sellQuantity)}주` : '-'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {activePositions.map(pos => {
                const investedAmount = pos.avgBuyPrice * pos.holdingQuantity;
                return (
                  <div key={pos.stockCode || pos.stockName} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-gray-800">{pos.stockName}</p>
                        {pos.stockCode && <p className="text-xs text-gray-400">{pos.stockCode}</p>}
                      </div>
                      <span className="text-lg font-bold text-gray-800">{formatNumber(pos.holdingQuantity)}주</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400 text-xs">평균매수가</span>
                        <p className="font-semibold">{formatNumber(Math.round(pos.avgBuyPrice))}원</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">투자금액</span>
                        <p className="font-semibold">{formatCurrency(Math.round(investedAmount))}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Closed Positions */}
      {closedPositions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              ✅ 정리 완료 종목
              <span className="text-sm font-normal text-gray-400">({closedPositions.length}개)</span>
            </h3>
          </div>
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">종목</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">총매수</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">총매도</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">실현손익</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">수익률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {closedPositions.map(pos => {
                  const pnlRate = pos.totalBuyCost > 0 ? (pos.realizedPnL / (pos.avgBuyPrice * pos.sellQuantity)) * 100 : 0;
                  return (
                    <tr key={pos.stockCode || pos.stockName} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <p className="font-bold text-gray-800">{pos.stockName}</p>
                        {pos.stockCode && <p className="text-xs text-gray-400">{pos.stockCode}</p>}
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-gray-600">{formatCurrency(pos.totalBuyCost)}</td>
                      <td className="px-4 py-4 text-right text-sm text-gray-600">{formatCurrency(pos.totalSellRevenue)}</td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-bold ${pos.realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {pos.realizedPnL >= 0 ? '+' : ''}{formatCurrency(Math.round(pos.realizedPnL))}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          pnlRate >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {pnlRate >= 0 ? '+' : ''}{pnlRate.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="md:hidden divide-y divide-gray-100">
            {closedPositions.map(pos => {
              const pnlRate = pos.totalBuyCost > 0 ? (pos.realizedPnL / (pos.avgBuyPrice * pos.sellQuantity)) * 100 : 0;
              return (
                <div key={pos.stockCode || pos.stockName} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-gray-800">{pos.stockName}</p>
                      {pos.stockCode && <p className="text-xs text-gray-400">{pos.stockCode}</p>}
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      pnlRate >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {pnlRate >= 0 ? '+' : ''}{pnlRate.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">실현손익</span>
                    <span className={`font-bold ${pos.realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {pos.realizedPnL >= 0 ? '+' : ''}{formatCurrency(Math.round(pos.realizedPnL))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
