local Utility = require("Utility")  -- Если Utility не требуется, закомментируй
local ArmletAbuse = {}

-- Создаём меню в Utility > Armlet Abuse
local menuPath = {"Utility", "Armlet Abuse"}
local option = Menu.AddOption(menuPath, "Enable", "On/Off")
local optionFarmMode = Menu.AddOption(menuPath, "Farming Mode", "Toggle on armlet when farming (On/Off)")
local safeThreshold = 550
local dangerousThreshold = 100
local lasttime = GameRules.GetGameTime()
local msg_queue = {}

-- Список опасных DoT-модификаторов (Urn, Vessel, etc.)
local dangerousModifiers = {
    "modifier_item_urn_damage",
    "modifier_item_spirit_vessel_damage",
    -- Добавь другие, например "modifier_ice_blast" для AA ульты
}

function ArmletAbuse.OnPrepareUnitOrders(orders)
    if not Menu.IsEnabled(option) then return true end
    if not orders then return true end
    local myHero = Heroes.GetLocal()
    if not myHero then return true end
    if not Utility.IsSuitableToUseItem(myHero) then return true end  -- Если Utility не нужен, удали
    local item = NPC.GetItem(myHero, "item_armlet", true)
    if not item then return true end
    local current = GameRules.GetGameTime()
    -- Вкл армлет перед атакой
    if not Ability.GetToggleState(item) and (orders.order == Enum.UnitOrder.DOTA_UNIT_ORDER_ATTACK_MOVE or orders.order == Enum.UnitOrder.DOTA_UNIT_ORDER_ATTACK_TARGET) then
        if not Menu.IsEnabled(optionFarmMode) and orders.target and NPC.IsCreep(orders.target) then
            return true
        end
        Ability.Toggle(item)
        lasttime = current
    end
    -- Выкл армлет при ходьбе, если ХП safe
    if Ability.GetToggleState(item) and Entity.GetHealth(myHero) >= safeThreshold and (orders.order == Enum.UnitOrder.DOTA_UNIT_ORDER_MOVE_TO_POSITION or orders.order == Enum.UnitOrder.DOTA_UNIT_ORDER_MOVE_TO_TARGET) then
        Ability.Toggle(item)
        lasttime = current
    end
    return true
end

function ArmletAbuse.OnUpdate()
    if not Menu.IsEnabled(option) then return end
    local myHero = Heroes.GetLocal()
    if not myHero then return end
    if not Utility.IsSuitableToUseItem(myHero) then return end
    local item = NPC.GetItem(myHero, "item_armlet", true)
    if not item then return end
    local current = GameRules.GetGameTime()
    if Entity.GetHealth(myHero) <= dangerousThreshold and current - lasttime > 0.6 then
        ArmletAbuse.Toggle()
    end
    if #msg_queue <= 0 then return end
    local timestamp = table.remove(msg_queue, 1)
    local err = 0.05
    if math.abs(timestamp - current) <= err then
        Ability.Toggle(item)
        lasttime = current
    elseif timestamp > current + err then
        table.insert(msg_queue, timestamp)
    end
end

function ArmletAbuse.OnProjectile(projectile)
    if not Menu.IsEnabled(option) then return end
    if not projectile or not projectile.source or not projectile.target then return end
    if not projectile.isAttack then return end
    local myHero = Heroes.GetLocal()
    if not myHero then return end
    if projectile.target ~= myHero then return end
    if Entity.IsSameTeam(projectile.source, myHero) then return end
    local true_damage = NPC.GetTrueDamage(projectile.source) * NPC.GetArmorDamageMultiplier(myHero)
    if true_damage + dangerousThreshold >= Entity.GetHealth(myHero) and Entity.GetHealth(myHero) > dangerousThreshold then
        ArmletAbuse.Toggle()
    end
end

function ArmletAbuse.OnUnitAnimation(animation)
    if not Menu.IsEnabled(option) then return end
    if not animation or not animation.sequenceName or not animation.unit then return end
    local myHero = Heroes.GetLocal()
    if not myHero then return end
    if Entity.IsSameTeam(animation.unit, myHero) then return end
    if NPC.IsRanged(animation.unit) then return end
    if not NPC.IsEntityInRange(myHero, animation.unit, 150) then return end
    local true_damage = NPC.GetTrueDamage(animation.unit) * NPC.GetArmorDamageMultiplier(myHero)
    if true_damage + dangerousThreshold >= Entity.GetHealth(myHero) and Entity.GetHealth(myHero) > dangerousThreshold then
        ArmletAbuse.Toggle()
    end
end

function ArmletAbuse.OnModifierCreate(modifier)
    if not Menu.IsEnabled(option) then return end
    local myHero = Heroes.GetLocal()
    if not myHero then return end
    if not modifier or modifier:GetParent() ~= myHero then return end
    local modName = modifier:GetName()
    local found = false
    for _, v in ipairs(dangerousModifiers) do
        if v == modName then found = true break end
    end
    if not found then return end
    local remainingTime = modifier:GetRemainingTime()
    local elapsedTime = modifier:GetElapsedTime()
    local tickPeriod = 1.0  -- Для Urn/Vessel — 1 сек
    local current = GameRules.GetGameTime()
    local timeSinceLastTick = elapsedTime % tickPeriod
    local timeToNextTick = tickPeriod - timeSinceLastTick
    if Entity.GetHealth(myHero) < 400 then
        local numTicksLeft = math.floor(remainingTime / tickPeriod)
        for i = 1, numTicksLeft do
            local tickTime = current + timeToNextTick + (i - 1) * tickPeriod
            table.insert(msg_queue, tickTime - 0.05)  -- Вкл перед тиком
            table.insert(msg_queue, tickTime + 0.05)  -- Выкл после
        end
    end
end

function ArmletAbuse.Toggle()
    local myHero = Heroes.GetLocal()
    if not myHero then return end
    local item = NPC.GetItem(myHero, "item_armlet", true)
    if not item then return end
    local current = GameRules.GetGameTime()
    if Ability.GetToggleState(item) then
        table.insert(msg_queue, current)
        table.insert(msg_queue, current + 0.1)
    else
        table.insert(msg_queue, current)
    end
end

return ArmletAbuse

return Armlet
