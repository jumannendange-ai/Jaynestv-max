package com.jaynes.maxtv.ui.home

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.jaynes.maxtv.R
import com.jaynes.maxtv.databinding.ItemChannelBinding
import com.jaynes.maxtv.model.Channel

class ChannelAdapter(
    private val onClick: (Channel) -> Unit
) : ListAdapter<Channel, ChannelAdapter.VH>(DIFF) {

    inner class VH(val b: ItemChannelBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(ch: Channel) {
            b.tvChannelName.text = ch.name
            b.tvCategory.text    = ch.category.uppercase()
            b.tvBadge.text       = if (ch.premium) "PREMIUM" else "FREE"
            b.tvBadge.setBackgroundResource(
                if (ch.premium) R.drawable.bg_badge_premium else R.drawable.bg_badge_free
            )
            Glide.with(b.root.context)
                .load(ch.logoUrl)
                .placeholder(R.drawable.ic_channel_placeholder)
                .error(R.drawable.ic_channel_placeholder)
                .into(b.ivLogo)
            b.root.setOnClickListener { onClick(ch) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH =
        VH(ItemChannelBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) =
        holder.bind(getItem(position))

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<Channel>() {
            override fun areItemsTheSame(a: Channel, b: Channel) = a.id == b.id
            override fun areContentsTheSame(a: Channel, b: Channel) = a == b
        }
    }
}
