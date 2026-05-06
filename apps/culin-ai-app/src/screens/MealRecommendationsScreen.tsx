import Logo from "@/src/components/Logo";
import SourcesFooter from "@/src/components/SourcesFooter";
import { useAuth } from "@/src/contexts/AuthContext";
import { formatDate, getGreeting } from "@/src/utils/dateUtils";
import { MaterialIcons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function MealRecommendationsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { userData, currentUser } = useAuth();
  const userName = userData?.displayName || "User";
  const greeting = getGreeting();
  const todayDate = formatDate();
  
  const recommendations = [
    {
      id: 1,
      mealType: "Breakfast",
      title: "Avocado Toast with Egg",
      calories: "350 kcal",
      prepTime: "10m prep",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCcw9N8n_w4OGJtEWsebXlgIwxq5MNIw5wjpOBosMY7mCrpO3h-kDxHuAR0dkytBOU2TvztW2WpPy3y0dkkEqAI9zLr3g2D8dLzq2tfP6chElyVzIL9_NKtwJg5Ahy-ZzjUkO-gH02288LpowtvLY_1VF3SoHMyoPFoquQsEb-b4YkHoZFUz8PMSTaRfj-TRarj155Fr61_KCxlM9hJHp_BCoCWw0EUyWB4iqRl5PzwkJmI0DAgePRH32b4UIC8WJoheKPAVgljZp2v",
      actionType: "make",
      actionLabel: "Make",
      actionIcon: "skillet",
    },
    {
      id: 2,
      mealType: "Lunch",
      title: "Grilled Chicken Caesar Salad",
      calories: "450 kcal",
      prepTime: "15m prep",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCXsuMYiYOawMJYMKFypEcRmMghS9-9yqpnTigEdvYu2EWzWJgBRm669Gq7TCsIBkVDzVTCQFTbaMiWhZTrDCLKidMJO2Rpno65ePByIXpRutcd0hziC6D8JJuNFiRpdizb0t2I2S-jlWsy18jj7UevOSo6IyUAKvLtOIKqrP4HbHscZljLidWqPr9tSXMaxHp11COnoQA3WNJEuL-9TKcvWCbpFFPKIjzRWUkxBqy52T7UJw5okSJQA2qnV1FXDOXED0dXEavvdn0B",
      actionType: "grab",
      actionLabel: "Grab",
      actionIcon: "shopping-bag",
    },
    {
      id: 3,
      mealType: "Dinner",
      title: "Salmon & Quinoa Bowl",
      calories: "600 kcal",
      prepTime: "30m prep",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDsc77HiEmw2eUJplNcMFQYGx3SgPqPs9LBW21Up2utYASFyr_rleFlTOjyIEz21dXpahZjcutJilhmMuLuI-__GRkJu3BmPn1kUq1eC8cWOtHsI_wEhTfun0kF_xleIUC9zx6bST59J2gRRKhpNCI2mVt8S0aVshjxZVlpdDP6vLrdf6gfmpbvSk7107vd9wJz7A3kgNn0N_h1WtR894lf7H335zAthjQbdkN_rlQ6-6_iMnGTGvBjUAZryTjICzplp2jPcqAZ9fo9",
      actionType: "order",
      actionLabel: "Order Out",
      actionIcon: "moped",
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Logo size={40} style={styles.logo} />
          <View>
            <Text style={styles.dateText}>{todayDate}, Today</Text>
            <Text style={styles.greetingText}>{greeting}, {userName}</Text>
          </View>
        </View>
        <View style={styles.avatarContainer}>
          <Image
            source={{
              uri: userData?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuA-D6cI61aSDBf1K-ee_Cic-9VJZXVVnLopfWoFJglvXO3IeI5ax4P3B_LoTkpb5uKR_HKjrzoebLoXCi6B28CNe8u5Gi0gqE3s1PLD8KrRdQZcaKEHs9OxeaJQ2n1iUu7bbYFoXeWylgnnrGxYcNqIj0Gwfl59oINse9Jt_DDgWrg5HAPUk-xwPX4LkC5AACSa-cPgFiF4XY7yO15VYahRZOdxf0-pjtT-udd2ij-ZtyTMwwbm88BFZvx4qgab7U8S6fkZX9IEnyGE",
            }}
            style={styles.avatar}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {recommendations.map((meal) => (
          <View key={meal.id} style={styles.mealCard}>
            {/* Image Section */}
            <View style={styles.imageContainer}>
              <Image source={{ uri: meal.imageUrl }} style={styles.mealImage} />
              <View style={styles.imageOverlay} />
              <View style={styles.mealTypeBadge}>
                <Text style={styles.mealTypeText}>{meal.mealType}</Text>
              </View>
            </View>

            {/* Content Section */}
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealTitle}>{meal.title}</Text>
                  <Text style={styles.mealMeta}>
                    {meal.calories} • {meal.prepTime}
                  </Text>
                </View>
                <Pressable>
                  <MaterialIcons
                    name="expand-more"
                    size={24}
                    color="#94a3b8"
                  />
                </Pressable>
              </View>

              {/* Action Button */}
              <Pressable
                style={[
                  styles.actionButton,
                  meal.actionType === "order"
                    ? styles.disabledButton
                    : meal.actionType === "make"
                      ? styles.primaryButton
                      : styles.secondaryButton,
                ]}
                disabled={meal.actionType === "order"}
              >
                <MaterialIcons
                  name={meal.actionIcon as any}
                  size={20}
                  color={meal.actionType === "order" ? "#94a3b8" : meal.actionType === "make" ? "#fff" : "#475569"}
                />
                <Text
                  style={[
                    styles.actionButtonText,
                    meal.actionType === "order"
                      ? styles.disabledButtonText
                      : meal.actionType === "make"
                        ? styles.primaryButtonText
                        : styles.secondaryButtonText,
                  ]}
                >
                  {meal.actionType === "order" ? "Coming Soon" : meal.actionLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        {/* Delivery Coming Soon Card */}
        <View style={styles.deliveryCard}>
          <View style={styles.deliveryIconRow}>
            <View style={styles.deliveryIconBg}>
              <MaterialIcons name="delivery-dining" size={28} color="#137fec" />
            </View>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonBadgeText}>Coming Soon</Text>
            </View>
          </View>
          <Text style={styles.deliveryTitle}>Food Delivery</Text>
          <Text style={styles.deliveryDesc}>
            {"Order meals straight to your door based on your nutrition goals. We're working on bringing this to you soon."}
          </Text>
          <View style={styles.deliveryDivider} />
          <View style={styles.deliveryFeatures}>
            {[
              { icon: "track-changes", label: "Macro-matched meals" },
              { icon: "local-shipping", label: "Delivered to your door" },
              { icon: "restaurant-menu", label: "Curated by your goals" },
            ].map((f) => (
              <View key={f.label} style={styles.deliveryFeatureRow}>
                <MaterialIcons name={f.icon as any} size={18} color="#94a3b8" />
                <Text style={styles.deliveryFeatureText}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <SourcesFooter />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f7f8",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: "#f6f7f8",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  logo: {
    marginRight: 4,
  },
  dateText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4c739a",
    marginBottom: 4,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0d141b",    
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#fff",
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  mealCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  imageContainer: {
    height: 192,
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  mealImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  mealTypeBadge: {
    position: "absolute",
    bottom: 12,
    left: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  mealTypeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  cardContent: {
    padding: 20,
    gap: 20,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  mealInfo: {
    flex: 1,
  },
  mealTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0d141b",
    marginBottom: 4,
  },
  mealMeta: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4c739a",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  primaryButton: {
    backgroundColor: "#137fec",
  },
  secondaryButton: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "transparent",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButtonText: {
    color: "#fff",
  },
  secondaryButtonText: {
    color: "#475569",
  },
  disabledButton: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  disabledButtonText: {
    color: "#94a3b8",
  },
  deliveryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0f2fe",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  deliveryIconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  deliveryIconBg: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
  },
  comingSoonBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  comingSoonBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#d97706",
    letterSpacing: 0.3,
  },
  deliveryTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0d141b",
    marginBottom: 6,
  },
  deliveryDesc: {
    fontSize: 14,
    fontWeight: "400",
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 16,
  },
  deliveryDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginBottom: 16,
  },
  deliveryFeatures: {
    gap: 10,
  },
  deliveryFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deliveryFeatureText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#475569",
  },
  bottomSpacer: {
    height: 100,
  },
});

