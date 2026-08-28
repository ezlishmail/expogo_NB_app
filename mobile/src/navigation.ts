// Shared navigation typing.
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Auth: undefined;
  Tabs: undefined;
  ProductDetail: { productId: string };
  Cart: undefined;
  Checkout: undefined;
  OrderDetail: { orderId: string; justPlaced?: boolean } | undefined;
  Notifications: undefined;
};

export type ProductDetailProps = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;
export type CartProps = NativeStackScreenProps<RootStackParamList, 'Cart'>;
export type CheckoutProps = NativeStackScreenProps<RootStackParamList, 'Checkout'>;
export type OrderDetailProps = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;
export type NotificationsProps = NativeStackScreenProps<RootStackParamList, 'Notifications'>;
