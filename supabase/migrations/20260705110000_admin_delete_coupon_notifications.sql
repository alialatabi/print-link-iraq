-- Coupon announcements are broadcast to every customer by an admin (AdminDiscounts):
-- deleting a coupon must also remove those notifications or they orphan in customers'
-- inboxes. Notifications had only "Users delete own notifications"; admins could
-- INSERT cross-user rows ("Only admins insert notifications") but never delete them.
-- Mirror that insert policy with a delete counterpart.
CREATE POLICY "Admins delete notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
