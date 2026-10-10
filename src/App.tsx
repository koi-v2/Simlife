import React, { useState, useEffect } from 'react';
import {
  GameScreen,
  ActiveTab,
  PlayerState,
  DilemmaChoice,
  CourseItem,
  JobRole,
  PantryItem,
  PartnerCandidate,
  PropertyCatalogItem,
  OwnedProperty,
} from './types/game';
import {
  createInitialPlayerState,
  advanceOneMonth,
  calculateNetWorth,
  formatIDR,
  formatCompactIDR,
} from './utils/financeEngine';
import { playSoundEffect } from './utils/soundFX';
import { TopBar } from './components/TopBar';
import { TitleScreen } from './components/TitleScreen';
import { LeftPersonaSidebar } from './components/LeftPersonaSidebar';
import { SummaryView } from './components/SummaryView';
import { CareerView } from './components/CareerView';
import { KitchenView } from './components/KitchenView';
import { RelationshipView } from './components/RelationshipView';
import { PropertyView } from './components/PropertyView';
import { FinanceView } from './components/FinanceView';

const STORAGE_KEY = 'lini_masa_save_v1';

export function App() {
  const [screen, setScreen] = useState<GameScreen>('TITLE_MENU');
  const [activeTab, setActiveTab] = useState<ActiveTab>('RINGKASAN');
  const [playerState, setPlayerState] = useState<PlayerState>(() =>
    createInitialPlayerState('Raka Pratama', 'RINTISAN_MANDIRI')
  );
  const [hasSavedGame, setHasSavedGame] = useState<boolean>(false);

  // Check localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PlayerState;
        if (parsed && typeof parsed.cash === 'number' && !parsed.gameOverReason) {
          setHasSavedGame(true);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Auto-save whenever playerState updates during active play
  useEffect(() => {
    if (screen === 'PLAYING') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(playerState));
      } catch {
        // Ignore quota errors
      }
    }
  }, [playerState, screen]);

  const appendLog = (
    state: PlayerState,
    title: string,
    body: string,
    category: PlayerState['logs'][0]['category'],
    impactSummary?: string
  ): PlayerState['logs'] => {
    const newEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      monthIndex: state.totalMonthsPlayed,
      ageYears: state.ageYears,
      monthOfYear: state.monthOfYear,
      title,
      body,
      category,
      impactSummary,
    };
    return [newEntry, ...state.logs].slice(0, 60);
  };

  const handleStartNewGame = (playerName: string, backgroundId: string) => {
    const fresh = createInitialPlayerState(playerName, backgroundId);
    setPlayerState(fresh);
    setActiveTab('RINGKASAN');
    setScreen('PLAYING');
  };

  const handleContinueSavedGame = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PlayerState;
        setPlayerState(parsed);
        setActiveTab('RINGKASAN');
        setScreen('PLAYING');
      }
    } catch {
      // Fallback to new game
    }
  };

  const handleAdvanceMonth = () => {
    if (playerState.activeDilemma) {
      playSoundEffect('WARNING');
      setActiveTab('RINGKASAN');
      return;
    }
    playSoundEffect('MONTH_ADVANCE');
    const nextState = advanceOneMonth(playerState);
    setPlayerState(nextState);
    if (nextState.gameOverReason) {
      setScreen('GAME_OVER');
    }
  };

  const handleResolveDilemma = (choice: DilemmaChoice) => {
    const { updatedState, outcomeLog } = choice.apply(playerState);
    const logs = appendLog(
      updatedState,
      `Keputusan: ${choice.label}`,
      outcomeLog,
      playerState.activeDilemma?.category || 'PERISTIWA',
      choice.effectSummary
    );
    setPlayerState({
      ...updatedState,
      activeDilemma: null,
      logs,
    });
  };

  const handleQuickAction = (actionType: 'FREELANCE' | 'REST_RELAX' | 'COOK_MEAL') => {
    if (actionType === 'FREELANCE') {
      if (playerState.energy < 25) return;
      const bonus =
        650_000 + (playerState.skills.teknologi + playerState.skills.finansial) * 18_000;
      const logs = appendLog(
        playerState,
        'Menyelesaikan Proyek Sampingan Akhir Pekan',
        `Kamu memanfaatkan keahlian profesionalmu untuk membantu klien lepas dan menerima honor bersih ${formatIDR(bonus)}.`,
        'KEUANGAN',
        `+${formatIDR(bonus)}`
      );
      setPlayerState({
        ...playerState,
        cash: playerState.cash + bonus,
        energy: playerState.energy - 25,
        stress: Math.min(100, playerState.stress + 7),
        logs,
      });
    } else if (actionType === 'COOK_MEAL') {
      if (playerState.energy < 10 || playerState.cash < 120_000) return;
      const logs = appendLog(
        playerState,
        'Memasak Menu Bergizi di Dapur Sendiri',
        'Kamu mengolah bahan sayur dan protein segar di dapur. Perut kembali kenyang dan tubuh terasa lebih bugar.',
        'KESEHATAN',
        'Kenyang +22 · Sehat +5'
      );
      setPlayerState({
        ...playerState,
        cash: playerState.cash - 120_000,
        energy: playerState.energy - 10,
        satiety: Math.min(100, playerState.satiety + 22),
        health: Math.min(100, playerState.health + 5),
        logs,
      });
    } else if (actionType === 'REST_RELAX') {
      if (playerState.energy < 15) return;
      const logs = appendLog(
        playerState,
        'Olahraga Pagi & Istirahat Berkualitas',
        'Kamu meluangkan waktu untuk lari pagi dan tidur lebih awal sehingga tingkat stres menurun drastis.',
        'KESEHATAN',
        'Stres -16 · Sehat +6'
      );
      setPlayerState({
        ...playerState,
        energy: playerState.energy - 15,
        stress: Math.max(0, playerState.stress - 16),
        health: Math.min(100, playerState.health + 6),
        happiness: Math.min(100, playerState.happiness + 6),
        logs,
      });
    }
  };

  // Career Handlers
  const handleWorkExtraShift = () => {
    if (playerState.energy < 25) return;
    const overtimePay = 1_200_000;
    const logs = appendLog(
      playerState,
      'Menuntaskan Target Lembur & Inisiatif Divisi',
      'Dedikasimu menyelesaikan proyek tambahan memberikan insentif tunai Rp1.200.000 serta meningkatkan penilaian performa kerja.',
      'KARIER',
      '+Rp1.200.000 · Performa +9'
    );
    setPlayerState({
      ...playerState,
      cash: playerState.cash + overtimePay,
      energy: playerState.energy - 25,
      jobPerformance: Math.min(100, playerState.jobPerformance + 9),
      stress: Math.min(100, playerState.stress + 8),
      logs,
    });
  };

  const handleTakeCourse = (course: CourseItem) => {
    if (playerState.cash < course.cost || playerState.energy < course.energyCost) return;
    const nextSkills = {
      teknologi: Math.min(100, playerState.skills.teknologi + (course.skillGain.teknologi || 0)),
      finansial: Math.min(100, playerState.skills.finansial + (course.skillGain.finansial || 0)),
      komunikasi: Math.min(100, playerState.skills.komunikasi + (course.skillGain.komunikasi || 0)),
      manajemen: Math.min(100, playerState.skills.manajemen + (course.skillGain.manajemen || 0)),
    };
    const logs = appendLog(
      playerState,
      `Lulus Sertifikasi: ${course.title}`,
      `Kamu menyelesaikan pelatihan di ${course.provider} dan meningkatkan kualifikasi kompetensi profesionalmu.`,
      'KARIER',
      `-${formatIDR(course.cost)}`
    );
    setPlayerState({
      ...playerState,
      cash: playerState.cash - course.cost,
      energy: playerState.energy - course.energyCost,
      skills: nextSkills,
      logs,
    });
  };

  const handleApplyJob = (job: JobRole) => {
    const logs = appendLog(
      playerState,
      `Dilantik Sebagai ${job.title}`,
      `Selamat! Lamaran dan rekam jejak kompetensimu diterima oleh ${job.companyType} dengan gaji pokok baru ${formatIDR(job.monthlySalary)} per bulan.`,
      'KARIER',
      `Gaji ${formatIDR(job.monthlySalary)}/bln`
    );
    setPlayerState({
      ...playerState,
      currentJobId: job.id,
      monthsInCurrentJob: 0,
      jobPerformance: 70,
      happiness: Math.min(100, playerState.happiness + 10),
      logs,
    });
  };

  // Kitchen & Living Handlers
  const handleSelectMealPlan = (planId: string) => {
    setPlayerState({
      ...playerState,
      activeMealPlanId: planId,
    });
  };

  const handleBuyPantryItem = (item: PantryItem) => {
    if (playerState.cash < item.cost) return;
    const logs = appendLog(
      playerState,
      `Konsumsi Gizi: ${item.name}`,
      item.description,
      'KESEHATAN',
      `Kenyang +${item.satietyGain} · -${formatIDR(item.cost)}`
    );
    setPlayerState({
      ...playerState,
      cash: playerState.cash - item.cost,
      satiety: Math.min(100, playerState.satiety + item.satietyGain),
      health: Math.min(100, playerState.health + item.healthGain),
      energy: Math.min(100, playerState.energy + item.energyGain),
      happiness: Math.min(100, playerState.happiness + item.happinessGain),
      logs,
    });
  };

  const handleChangeLivingRent = (
    mode: 'KOS_SEDERHANA' | 'APARTEMEN_SEWA',
    rentCost: number
  ) => {
    setPlayerState({
      ...playerState,
      livingArrangement: mode,
      monthlyRentExpense: rentCost,
    });
  };

  // Relationship & Marriage Handlers
  const handleInteractCandidate = (
    candidate: PartnerCandidate,
    action:
      | 'CHAT_COFFEE'
      | 'DINNER_DATE'
      | 'START_DATING'
      | 'PROPOSE_ENGAGEMENT'
      | 'HOLD_WEDDING'
  ) => {
    const currentAffinity = playerState.affinities[candidate.id] || 0;

    if (action === 'CHAT_COFFEE') {
      if (playerState.cash < 150_000 || playerState.energy < 12) return;
      const newAff = Math.min(100, currentAffinity + 9);
      const isPartner = playerState.relationship.partnerId === candidate.id;
      const logs = appendLog(
        playerState,
        `Bincang Sore Bersama ${candidate.name}`,
        `Membahas topik ${candidate.favoriteTopic} sambil menikmati kopi hangat.`,
        'RELASI',
        'Kedekatan +9'
      );
      setPlayerState({
        ...playerState,
        cash: playerState.cash - 150_000,
        energy: playerState.energy - 12,
        happiness: Math.min(100, playerState.happiness + 4),
        affinities: { ...playerState.affinities, [candidate.id]: newAff },
        relationship: isPartner
          ? {
              ...playerState.relationship,
              affection: Math.min(100, playerState.relationship.affection + 9),
            }
          : playerState.relationship,
        logs,
      });
    } else if (action === 'DINNER_DATE') {
      if (playerState.cash < 550_000 || playerState.energy < 18) return;
      const newAff = Math.min(100, currentAffinity + 18);
      const isPartner = playerState.relationship.partnerId === candidate.id;
      const logs = appendLog(
        playerState,
        `Makan Malam Istimewa Bersama ${candidate.name}`,
        `Suasana hangat dan obrolan mendalam mempererat ikatan emosional kalian.`,
        'RELASI',
        'Kedekatan +18'
      );
      setPlayerState({
        ...playerState,
        cash: playerState.cash - 550_000,
        energy: playerState.energy - 18,
        satiety: Math.min(100, playerState.satiety + 20),
        happiness: Math.min(100, playerState.happiness + 9),
        affinities: { ...playerState.affinities, [candidate.id]: newAff },
        relationship: isPartner
          ? {
              ...playerState.relationship,
              affection: Math.min(100, playerState.relationship.affection + 18),
            }
          : playerState.relationship,
        logs,
      });
    } else if (action === 'START_DATING') {
      const logs = appendLog(
        playerState,
        `Resmi Berpacaran dengan ${candidate.name}`,
        `Kalian sepakat menjalin hubungan serius dan saling mendukung perjalanan karier maupun rencana masa depan.`,
        'RELASI',
        'Status: Pacaran'
      );
      setPlayerState({
        ...playerState,
        happiness: Math.min(100, playerState.happiness + 12),
        relationship: {
          ...playerState.relationship,
          partnerId: candidate.id,
          status: 'PACARAN',
          affection: Math.max(60, currentAffinity),
        },
        logs,
      });
    } else if (action === 'PROPOSE_ENGAGEMENT') {
      if (playerState.cash < 8_500_000) return;
      const logs = appendLog(
        playerState,
        `Melamar & Bertunangan dengan ${candidate.name}`,
        `Lamaranmu diterima dengan penuh haru! Kalian mulai menyusun anggaran pernikahan dan tempat tinggal keluarga.`,
        'RELASI',
        '-Rp8.500.000 · Status: Tunangan'
      );
      setPlayerState({
        ...playerState,
        cash: playerState.cash - 8_500_000,
        happiness: Math.min(100, playerState.happiness + 15),
        relationship: {
          ...playerState.relationship,
          status: 'TUNANGAN',
          affection: Math.min(100, playerState.relationship.affection + 12),
        },
        logs,
      });
    } else if (action === 'HOLD_WEDDING') {
      if (playerState.cash < 35_000_000) return;
      const logs = appendLog(
        playerState,
        `Pernikahan Bahagia Bersama ${candidate.name}`,
        `Resepsi pernikahan berlangsung khidmat dan hangat. Kini kalian resmi menjadi pasangan suami-istri dan mengelola masa depan finansial bersama.`,
        'RELASI',
        `Menikah · Gaji Pasangan ${formatIDR(candidate.monthlyIncome)}/bln`
      );
      setPlayerState({
        ...playerState,
        cash: playerState.cash - 35_000_000,
        happiness: 100,
        stress: Math.max(0, playerState.stress - 20),
        relationship: {
          ...playerState.relationship,
          status: 'MENIKAH',
          affection: 95,
          monthsMarried: 1,
        },
        logs,
      });
    }
  };

  const handleToggleJointFinance = (mode: 'GABUNGAN' | 'TERPISAH') => {
    setPlayerState({
      ...playerState,
      relationship: {
        ...playerState.relationship,
        jointFinanceMode: mode,
      },
    });
  };

  const handleFamilyTime = () => {
    if (playerState.cash < 350_000 || playerState.energy < 15) return;
    const logs = appendLog(
      playerState,
      'Menghabiskan Akhir Pekan Berkualitas Bersama Pasangan',
      'Komunikasi yang terbuka dan waktu berkualitas bersama menjaga keharmonisan rumah tangga.',
      'RELASI',
      'Afeksi +10 · Stres -10'
    );
    setPlayerState({
      ...playerState,
      cash: playerState.cash - 350_000,
      energy: playerState.energy - 15,
      stress: Math.max(0, playerState.stress - 10),
      happiness: Math.min(100, playerState.happiness + 8),
      relationship: {
        ...playerState.relationship,
        affection: Math.min(100, playerState.relationship.affection + 10),
      },
      logs,
    });
  };

  const handlePlanChild = () => {
    if (playerState.cash < 12_000_000) return;
    const nextCount = playerState.relationship.childrenCount + 1;
    const logs = appendLog(
      playerState,
      `Kelahiran Anak Ke-${nextCount} dalam Keluarga`,
      'Kehadiran buah hati membawa kebahagiaan luar biasa sekaligus tanggung jawab anggaran gizi dan pendidikan baru.',
      'RELASI',
      `Anak Ke-${nextCount} · -Rp12.000.000`
    );
    setPlayerState({
      ...playerState,
      cash: playerState.cash - 12_000_000,
      happiness: 100,
      relationship: {
        ...playerState.relationship,
        childrenCount: nextCount,
      },
      logs,
    });
  };

  // Property & Real Estate Handlers
  const handleBuyProperty = (
    catalogItem: PropertyCatalogItem,
    purchasePrice: number,
    totalUpfrontCashNeeded: number,
    tenorYears: number,
    monthlyInstallment: number,
    interestRateAnnual: number
  ) => {
    if (playerState.cash < totalUpfrontCashNeeded) return;
    const closingFee = Math.round(purchasePrice * 0.035);
    const actualDownPayment = totalUpfrontCashNeeded - closingFee;
    const principalLoan = Math.max(0, purchasePrice - actualDownPayment);

    const hasOccupiedHome = playerState.properties.some((p) => p.usage === 'DIHUNI_SENDIRI');
    const defaultUsage: OwnedProperty['usage'] =
      !hasOccupiedHome && catalogItem.category !== 'KOS_KONTRAKAN'
        ? 'DIHUNI_SENDIRI'
        : 'DISEWAKAN';

    const liveRent = Math.round(
      catalogItem.estimatedMonthlyRent * (playerState.macro.propertyPriceIndex / 100)
    );

    const newProp: OwnedProperty = {
      instanceId: `prop_inst_${Date.now()}`,
      catalogId: catalogItem.id,
      name: catalogItem.name,
      location: catalogItem.location,
      category: catalogItem.category,
      purchasePrice,
      currentMarketValue: purchasePrice,
      purchaseMonthTotal: playerState.totalMonthsPlayed,
      condition: 96,
      isRenovated: false,
      usage: defaultUsage,
      hasTenant: defaultUsage === 'DISEWAKAN',
      tenantQuality: defaultUsage === 'DISEWAKAN' ? 'DISIPLIN' : null,
      monthlyRentIncome: liveRent,
      monthlyMaintenance: catalogItem.maintenanceCostPerMonth,
      mortgagePrincipalRemaining: principalLoan,
      mortgageMonthlyInstallment: monthlyInstallment,
      mortgageMonthsRemaining: tenorYears * 12,
      mortgageInterestRateAnnual: interestRateAnnual,
    };

    const logs = appendLog(
      playerState,
      `Akuisisi Properti: ${catalogItem.name}`,
      `Kamu resmi mengakuisisi ${catalogItem.name} seharga ${formatIDR(purchasePrice)} (${
        tenorYears > 0 ? `KPR ${tenorYears} tahun, cicilan ${formatIDR(monthlyInstallment)}/bln` : 'Tunai Lunas'
      }). Status awal: ${defaultUsage === 'DIHUNI_SENDIRI' ? 'Dihuni Sendiri' : 'Disewakan Aktif'}.`,
      'PROPERTI',
      `Aset +${formatCompactIDR(purchasePrice)}`
    );

    setPlayerState({
      ...playerState,
      cash: playerState.cash - totalUpfrontCashNeeded,
      properties: [...playerState.properties, newProp],
      livingArrangement:
        defaultUsage === 'DIHUNI_SENDIRI'
          ? 'RUMAH_MILIK_SENDIRI'
          : playerState.livingArrangement,
      logs,
    });
  };

  const handleTogglePropertyUsage = (
    instanceId: string,
    usage: 'DIHUNI_SENDIRI' | 'DISEWAKAN'
  ) => {
    const updated = playerState.properties.map((p) => {
      if (p.instanceId === instanceId) {
        return {
          ...p,
          usage,
          hasTenant: usage === 'DISEWAKAN' ? p.hasTenant : false,
        };
      }
      // Only 1 property needs to be occupied by self
      if (usage === 'DIHUNI_SENDIRI' && p.usage === 'DIHUNI_SENDIRI') {
        return { ...p, usage: 'DISEWAKAN' as const, hasTenant: true, tenantQuality: 'STANDAR' as const };
      }
      return p;
    });

    setPlayerState({
      ...playerState,
      properties: updated,
    });
  };

  const handleFindTenant = (instanceId: string) => {
    if (playerState.cash < 500_000) return;
    const updated = playerState.properties.map((p) =>
      p.instanceId === instanceId
        ? { ...p, hasTenant: true, tenantQuality: 'DISIPLIN' as const }
        : p
    );
    const logs = appendLog(
      playerState,
      'Menemukan Penyewa Properti Baru',
      'Melalui seleksi agen properti, unitmu kembali terisi penyewa dengan kontrak tahunan yang tertib.',
      'PROPERTI',
      '-Rp500.000 · Unit Terisi'
    );
    setPlayerState({
      ...playerState,
      cash: playerState.cash - 500_000,
      properties: updated,
      logs,
    });
  };

  const handleRenovateProperty = (
    instanceId: string,
    cost: number,
    valueBoostPercent: number,
    rentBoostPercent: number
  ) => {
    if (playerState.cash < cost) return;
    const target = playerState.properties.find((p) => p.instanceId === instanceId);
    if (!target) return;

    const updated = playerState.properties.map((p) => {
      if (p.instanceId !== instanceId) return p;
      return {
        ...p,
        isRenovated: true,
        condition: 100,
        currentMarketValue: Math.round(p.currentMarketValue * (1 + valueBoostPercent / 100)),
        monthlyRentIncome: Math.round(p.monthlyRentIncome * (1 + rentBoostPercent / 100)),
      };
    });

    const logs = appendLog(
      playerState,
      `Renovasi Arsitektur ${target.name}`,
      `Peningkatan fasad dan interior mendongkrak nilai pasar properti sebesar +${valueBoostPercent}% dan tarif sewa bulanan sebesar +${rentBoostPercent}%.`,
      'PROPERTI',
      `Sewa +${rentBoostPercent}%`
    );

    setPlayerState({
      ...playerState,
      cash: playerState.cash - cost,
      properties: updated,
      logs,
    });
  };

  const handlePayOffMortgageEarly = (instanceId: string) => {
    const target = playerState.properties.find((p) => p.instanceId === instanceId);
    if (!target || playerState.cash < target.mortgagePrincipalRemaining) return;

    const payoffCost = target.mortgagePrincipalRemaining;
    const updated = playerState.properties.map((p) =>
      p.instanceId === instanceId
        ? {
            ...p,
            mortgagePrincipalRemaining: 0,
            mortgageMonthlyInstallment: 0,
            mortgageMonthsRemaining: 0,
          }
        : p
    );

    const logs = appendLog(
      playerState,
      `Pelunasan Dipercepat KPR ${target.name}`,
      `Kamu melunasi seluruh sisa pokok KPR sebesar ${formatIDR(payoffCost)}. Sertifikat hak milik kini bebas agunan dan arus kas bulanan semakin lega!`,
      'PROPERTI',
      'KPR Lunas 100%'
    );

    setPlayerState({
      ...playerState,
      cash: playerState.cash - payoffCost,
      properties: updated,
      logs,
    });
  };

  const handleSellProperty = (instanceId: string) => {
    const target = playerState.properties.find((p) => p.instanceId === instanceId);
    if (!target) return;

    const netProceeds =
      Math.round(target.currentMarketValue * 0.97) - target.mortgagePrincipalRemaining;
    const updated = playerState.properties.filter((p) => p.instanceId !== instanceId);

    const logs = appendLog(
      playerState,
      `Pelepasan & Penjualan ${target.name}`,
      `Aset properti terjual pada harga pasar ${formatIDR(target.currentMarketValue)}. Setelah dikurangi pajak transaksi dan pelunasan sisa KPR, kas bersih yang diterima adalah ${formatIDR(netProceeds)}.`,
      'PROPERTI',
      `Kas +${formatCompactIDR(netProceeds)}`
    );

    setPlayerState({
      ...playerState,
      cash: playerState.cash + netProceeds,
      properties: updated,
      logs,
    });
  };

  // Finance & Investment Handlers
  const handleAllocateInvestment = (
    instrument: 'DEPOSITO' | 'SBN' | 'REKSADANA',
    direction: 'TOPUP' | 'WITHDRAW',
    amount: number
  ) => {
    if (amount <= 0) return;
    if (direction === 'TOPUP' && playerState.cash < amount) return;

    const inv = { ...playerState.investments };
    let newCash = playerState.cash;

    if (instrument === 'DEPOSITO') {
      if (direction === 'TOPUP') {
        inv.depositoBalance += amount;
        newCash -= amount;
      } else {
        const actual = Math.min(amount, inv.depositoBalance);
        inv.depositoBalance -= actual;
        newCash += actual;
      }
    } else if (instrument === 'SBN') {
      if (direction === 'TOPUP') {
        inv.sbnBalance += amount;
        newCash -= amount;
      } else {
        const actual = Math.min(amount, inv.sbnBalance);
        inv.sbnBalance -= actual;
        newCash += actual;
      }
    } else if (instrument === 'REKSADANA') {
      if (direction === 'TOPUP') {
        inv.reksadanaSahamBalance += amount;
        newCash -= amount;
      } else {
        const actual = Math.min(amount, inv.reksadanaSahamBalance);
        inv.reksadanaSahamBalance -= actual;
        newCash += actual;
      }
    }

    setPlayerState({
      ...playerState,
      cash: newCash,
      investments: inv,
    });
  };

  const handleToggleInsurance = () => {
    setPlayerState({
      ...playerState,
      hasHealthInsurance: !playerState.hasHealthInsurance,
    });
  };

  if (screen === 'TITLE_MENU') {
    return (
      <TitleScreen
        onStartNewGame={handleStartNewGame}
        hasSavedGame={hasSavedGame}
        onContinueSavedGame={handleContinueSavedGame}
      />
    );
  }

  if (screen === 'GAME_OVER') {
    const finalNw = calculateNetWorth(playerState);
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white border border-stone-200 rounded-xl p-8 space-y-6">
          <div className="border-b border-stone-200 pb-4">
            <p className="text-xs font-medium text-red-700">Akhir Perjalanan Simulasi</p>
            <h1 className="font-display text-3xl font-bold text-stone-900 mt-1">
              Lembaran Hidup Terhenti pada Usia {playerState.ageYears} Tahun
            </h1>
          </div>

          <p className="text-sm text-stone-700 leading-relaxed">
            {playerState.gameOverReason}
          </p>

          <div className="p-4 bg-[#FAF8F5] rounded-lg border border-stone-200 space-y-2 text-xs font-mono tabular-nums">
            <div className="flex justify-between">
              <span className="font-sans text-stone-500">Total Bulan Dijalani</span>
              <span className="text-stone-900 font-semibold">
                {playerState.totalMonthsPlayed} Bulan
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans text-stone-500">Kekayaan Bersih Akhir</span>
              <span className="text-stone-900 font-semibold">{formatIDR(finalNw.netWorth)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans text-stone-500">Jumlah Aset Properti</span>
              <span className="text-stone-900 font-semibold">
                {playerState.properties.length} Unit
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              setHasSavedGame(false);
              setScreen('TITLE_MENU');
            }}
            className="w-full py-3 px-4 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            Mainkan Kembali dari Awal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col">
      {/* Strict 3-Zone Top Bar */}
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onAdvanceMonth={handleAdvanceMonth}
        hasActiveDilemma={Boolean(playerState.activeDilemma)}
      />

      {/* Full-Width Desktop Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] w-full mx-auto">
        <LeftPersonaSidebar
          state={playerState}
          onResetGame={() => {
            playSoundEffect('CLICK');
            setScreen('TITLE_MENU');
          }}
        />

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {activeTab === 'RINGKASAN' && (
            <SummaryView
              state={playerState}
              onResolveDilemma={handleResolveDilemma}
              onQuickAction={handleQuickAction}
              onNavigateTab={setActiveTab}
              onAdvanceMonth={handleAdvanceMonth}
            />
          )}

          {activeTab === 'KARIER' && (
            <CareerView
              state={playerState}
              onWorkExtraShift={handleWorkExtraShift}
              onTakeCourse={handleTakeCourse}
              onApplyJob={handleApplyJob}
            />
          )}

          {activeTab === 'DAPUR' && (
            <KitchenView
              state={playerState}
              onSelectMealPlan={handleSelectMealPlan}
              onBuyPantryItem={handleBuyPantryItem}
              onChangeLivingRent={handleChangeLivingRent}
            />
          )}

          {activeTab === 'RELASI' && (
            <RelationshipView
              state={playerState}
              onInteractCandidate={handleInteractCandidate}
              onToggleJointFinance={handleToggleJointFinance}
              onFamilyTime={handleFamilyTime}
              onPlanChild={handlePlanChild}
            />
          )}

          {activeTab === 'PROPERTI' && (
            <PropertyView
              state={playerState}
              onBuyProperty={handleBuyProperty}
              onTogglePropertyUsage={handleTogglePropertyUsage}
              onFindTenant={handleFindTenant}
              onRenovateProperty={handleRenovateProperty}
              onPayOffMortgageEarly={handlePayOffMortgageEarly}
              onSellProperty={handleSellProperty}
            />
          )}

          {activeTab === 'KEUANGAN' && (
            <FinanceView
              state={playerState}
              onAllocateInvestment={handleAllocateInvestment}
              onToggleInsurance={handleToggleInsurance}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
