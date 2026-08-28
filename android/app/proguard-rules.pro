# Retrofit/kotlinx-serialization keep rules
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*
-keepclassmembers class com.northernbloom.customer.core.dto.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
