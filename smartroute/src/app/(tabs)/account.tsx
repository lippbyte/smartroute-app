import AccountCard from "@/components/AccountCard";
import HistoryCard from "@/components/HistoryCard";
import PreferenceCard from "@/components/PreferenceCard";
import ScreenBackground from "@/components/ScreenBackground";
import Text from "@/components/Text";
import TopNav from "@/components/TopNav";
import { ScrollView } from "react-native";

export default function AccountScreen() {
  return (
    <ScreenBackground>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pt-12 pb-28 px-5 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <TopNav />
        {/* Judul di atas latar biru malam — tetap putih. */}
        <Text className="text-3xl font-bold text-white">Akun Anda</Text>

        <AccountCard />
        <PreferenceCard />
        <HistoryCard />
      </ScrollView>
    </ScreenBackground>
  );
}
